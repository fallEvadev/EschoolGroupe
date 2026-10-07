"use server";

import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireActionRole } from "@/lib/auth/action-guard";
import {
  decideStatus,
  evaluateLocation,
  evaluateTiming,
  LOCK_MINUTES,
  lockState,
  locationExplanation,
  MAX_FAILED_ATTEMPTS,
  timingMessage,
} from "@/lib/attendance";
import {
  dakarIsoDate,
  dakarIsoWeekday,
  dakarMinutes,
  formatClock,
} from "@/lib/dates";
import { isWeekday, WEEKDAY_LABELS } from "@/lib/schools";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  attendanceSchema,
  type AttendanceResult,
} from "@/lib/validations/attendance";

/** Code PostgreSQL d'une valeur en double (ici : déjà pointé). */
const UNIQUE_VIOLATION = "23505";

const ERREUR_GENERIQUE: AttendanceResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

function fail(message: string): AttendanceResult {
  return { ok: false, message };
}

/** Comparaison en temps constant : la durée ne révèle pas les chiffres justes. */
function sameCode(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Enregistre le pointage du formateur connecté.
 *
 * Le serveur écrit avec la clé de service : la base interdit toute écriture
 * directe (voir la migration), donc TOUTES les règles sont contrôlées ici, dans
 * l'ordre, et rien n'est enregistré tant qu'elles ne sont pas toutes passées :
 * identité (jeton), créneau et affectation, jour, fenêtre horaire, doublon,
 * blocage des essais, puis code.
 */
export async function submitAttendance(
  input: unknown,
): Promise<AttendanceResult> {
  const caller = await requireActionRole(["formateur"]);
  if (!caller.ok) return fail(caller.message);

  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  }
  const { slotId, code, position } = parsed.data;

  try {
    const admin = createAdminSupabase();
    const now = new Date();
    const today = dakarIsoDate(now);

    // 1. Identité : la fiche liée au jeton, jamais une valeur envoyée.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, status")
      .eq("clerk_user_id", caller.actorId)
      .eq("role", "formateur")
      .maybeSingle();
    if (!profile || profile.status !== "actif") {
      return fail("Votre compte n'est pas actif. Contactez l'administration.");
    }

    // 2. Créneau actif, dans une école active.
    const { data: slot } = await admin
      .from("time_slots")
      .select("id, school_id, weekday, starts_at, ends_at, status")
      .eq("id", slotId)
      .maybeSingle();
    if (!slot || slot.status !== "actif") return fail("Créneau introuvable.");

    const { data: school } = await admin
      .from("schools")
      .select(
        "name, status, latitude, longitude, radius_m, late_tolerance_minutes",
      )
      .eq("id", slot.school_id)
      .maybeSingle();
    if (!school || school.status !== "actif") {
      return fail("Cette école n'est plus active.");
    }

    // 3. Le créneau fait bien partie du planning de CE formateur.
    const { data: assignment } = await admin
      .from("slot_assignments")
      .select("id")
      .eq("slot_id", slotId)
      .eq("profile_id", profile.id)
      .eq("status", "actif")
      .maybeSingle();
    if (!assignment) {
      return fail("Ce créneau ne fait pas partie de votre planning.");
    }

    // 4. Bon jour de la semaine.
    if (dakarIsoWeekday(now) !== slot.weekday) {
      const day = isWeekday(slot.weekday)
        ? WEEKDAY_LABELS[slot.weekday].toLowerCase()
        : "un autre jour";
      return fail(`Ce créneau a lieu le ${day}, pas aujourd'hui.`);
    }

    // 5. Fenêtre horaire (ouvre 30 min avant le début, ferme à la fin).
    const timing = evaluateTiming({
      nowMinutes: dakarMinutes(now),
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      toleranceMinutes: school.late_tolerance_minutes,
    });
    const timingProblem = timingMessage(timing);
    if (timingProblem || timing.state !== "open") {
      return fail(timingProblem ?? "Pointage impossible à cette heure.");
    }

    // 6. Déjà pointé sur ce créneau aujourd'hui ?
    const { data: already } = await admin
      .from("attendances")
      .select("recorded_at")
      .eq("profile_id", profile.id)
      .eq("slot_id", slotId)
      .eq("attendance_date", today)
      .maybeSingle();
    if (already) {
      return fail(
        `Vous avez déjà pointé sur ce créneau à ${formatClock(already.recorded_at)}.`,
      );
    }

    // 7. Blocage après trop de codes faux (les demandes bloquées ne comptent pas).
    const windowStart = new Date(now.getTime() - LOCK_MINUTES * 60_000);
    const { data: failures, error: failuresError } = await admin
      .from("attendance_attempts")
      .select("attempted_at")
      .eq("profile_id", profile.id)
      .eq("succeeded", false)
      .gte("attempted_at", windowStart.toISOString());
    if (failuresError) {
      console.error("attendance_attempts :", failuresError.message);
      return ERREUR_GENERIQUE;
    }
    const failureTimes = failures.map((row) => new Date(row.attempted_at));
    const lock = lockState(failureTimes, now);
    if (lock.locked) {
      return fail(
        `Trop de codes incorrects. Réessayez dans ${lock.minutesLeft} minute${lock.minutesLeft > 1 ? "s" : ""}.`,
      );
    }

    // 8. Le code du jour de cette école (jamais envoyé au navigateur).
    const { data: daily } = await admin
      .from("daily_codes")
      .select("code")
      .eq("school_id", slot.school_id)
      .eq("code_date", today)
      .eq("status", "actif")
      .maybeSingle();
    if (!daily) {
      return fail(
        "Le code du jour n'a pas encore été généré pour cette école. Contactez la Direction pédagogique.",
      );
    }

    if (!sameCode(daily.code, code)) {
      await admin.from("attendance_attempts").insert({
        profile_id: profile.id,
        school_id: slot.school_id,
        succeeded: false,
      });
      const left = lock.remaining - 1;
      return fail(
        left > 0
          ? `Code incorrect. Il vous reste ${left} tentative${left > 1 ? "s" : ""}.`
          : `Code incorrect. Pointage bloqué pendant ${LOCK_MINUTES} minutes après ${MAX_FAILED_ATTEMPTS} essais.`,
      );
    }

    // 9. Code juste : contrôle de position et statut final.
    const evaluation = evaluateLocation(
      {
        latitude: school.latitude,
        longitude: school.longitude,
        radiusM: school.radius_m,
      },
      position,
    );
    const status = decideStatus(evaluation.result, timing.late);

    // Les coordonnées exactes du formateur ne sont jamais conservées : seulement
    // la distance et la précision.
    const { data: created, error } = await admin
      .from("attendances")
      .insert({
        profile_id: profile.id,
        slot_id: slotId,
        school_id: slot.school_id,
        attendance_date: today,
        status,
        late_minutes: timing.lateMinutes,
        location_result: evaluation.result,
        distance_m: evaluation.distanceM,
        accuracy_m: evaluation.accuracyM,
      })
      .select("recorded_at")
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return fail("Vous avez déjà pointé sur ce créneau aujourd'hui.");
      }
      console.error("attendances :", error.message);
      return ERREUR_GENERIQUE;
    }

    await admin.from("attendance_attempts").insert({
      profile_id: profile.id,
      school_id: slot.school_id,
      succeeded: true,
    });

    revalidatePath("/formateur");
    return {
      ok: true,
      status,
      recordedAt: created.recorded_at,
      fullName: profile.full_name,
      schoolName: school.name,
      lateMinutes: timing.lateMinutes,
      locationResult: evaluation.result,
      explanation: locationExplanation(evaluation, school.radius_m),
    };
  } catch (error) {
    console.error("submitAttendance :", error);
    return ERREUR_GENERIQUE;
  }
}
