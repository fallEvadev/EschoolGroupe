"use server";

import { revalidatePath } from "next/cache";

import { requireActionRole } from "@/lib/auth/action-guard";
import {
  codeOutcomeMessage,
  decideStatus,
  evaluateLocation,
  evaluateTiming,
  isCodeOutcome,
  locationExplanation,
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

/**
 * Enregistre le pointage du formateur connecté.
 *
 * Le serveur écrit avec la clé de service : la base interdit toute écriture
 * directe (voir la migration), donc TOUTES les règles sont contrôlées ici, dans
 * l'ordre, et rien n'est enregistré tant qu'elles ne sont pas toutes passées :
 * identité (jeton), créneau et affectation, jour, fenêtre horaire, doublon,
 * puis code. Le contrôle du code et la limite des essais se font dans une seule
 * transaction SQL (`verify_attendance_code`) : des requêtes simultanées ne
 * peuvent pas multiplier les essais.
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

    // 7. Limite des essais ET contrôle du code, en une seule transaction SQL.
    // Le code du jour n'est jamais envoyé au navigateur. En cas d'erreur, on
    // REFUSE le pointage (jamais « on laisse passer ») : sinon une panne
    // désactiverait la limite sans que personne ne le voie.
    const { data: check, error: checkError } = await admin.rpc(
      "verify_attendance_code",
      {
        p_profile_id: profile.id,
        p_school_id: slot.school_id,
        p_code_date: today,
        p_code: code,
      },
    );
    const verdict = check?.[0];
    if (checkError || !verdict || !isCodeOutcome(verdict.outcome)) {
      console.error(
        "verify_attendance_code :",
        checkError?.message ?? "réponse inattendue",
      );
      return ERREUR_GENERIQUE;
    }
    const codeProblem = codeOutcomeMessage(verdict.outcome, {
      remaining: verdict.remaining,
      minutesLeft: verdict.minutes_left,
    });
    if (codeProblem) return fail(codeProblem);

    // 8. Code juste : contrôle de position et statut final.
    const evaluation = evaluateLocation(
      {
        latitude: school.latitude,
        longitude: school.longitude,
        radiusM: school.radius_m,
      },
      position,
    );
    const status = decideStatus(evaluation.result, timing.late);

    // Le pointage garde la position GPS du formateur (coordonnées, distance à
    // l'école, précision). Ce sont des données personnelles : seuls le formateur
    // et la Direction pédagogique les lisent (RLS de `attendances`). Sans
    // position fournie par le téléphone, les deux coordonnées restent vides.
    const { data: created, error } = await admin
      .from("attendances")
      .insert({
        latitude: position.status === "ok" ? position.latitude : null,
        longitude: position.status === "ok" ? position.longitude : null,
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
