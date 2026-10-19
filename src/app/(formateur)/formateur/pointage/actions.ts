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
  departureSchema,
  type AttendanceResult,
  type DepartureResult,
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
 * Enregistre le pointage d'arrivée du formateur connecté.
 *
 * Le serveur écrit avec la clé de service : la base interdit toute écriture
 * directe (voir la migration), donc TOUTES les règles sont contrôlées ici, dans
 * l'ordre, et rien n'est enregistré tant qu'elles ne sont pas toutes passées :
 * identité (jeton), créneau et affectation, jour, fenêtre horaire, doublon,
 * puis position. L'arrivée se pointe sans code ; la descente, elle, exige le
 * code du directeur (voir `submitDeparture`).
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
  const { slotId, position } = parsed.data;

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

    // 7. Contrôle de position et statut final. Pas de code à l'arrivée : le code
    // du directeur valide la DESCENTE (voir `submitDeparture`).
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

const ERREUR_DESCENTE: DepartureResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

function failDeparture(message: string): DepartureResult {
  return { ok: false, message };
}

/**
 * Valide la descente du formateur connecté avec le code que le directeur donne
 * APRÈS le cours. Le formateur vient du jeton, jamais d'un champ envoyé.
 *
 * Tout se décide dans la fonction SQL `record_departure`, en une transaction :
 * le pointage doit être le sien et d'aujourd'hui, le code n'est pas accepté
 * avant la fin exacte du créneau (et un code donné trop tôt n'use pas les 5
 * essais), puis le code et la limite des essais sont contrôlés. Une erreur
 * REFUSE la descente (jamais « on laisse passer »). La clé de service sert
 * seulement à appeler cette fonction, réservée au serveur.
 */
export async function submitDeparture(
  input: unknown,
): Promise<DepartureResult> {
  const caller = await requireActionRole(["formateur"]);
  if (!caller.ok) return failDeparture(caller.message);

  const parsed = departureSchema.safeParse(input);
  if (!parsed.success) {
    return failDeparture(
      parsed.error.issues[0]?.message ?? "Données invalides.",
    );
  }
  const { attendanceId, code } = parsed.data;

  try {
    const admin = createAdminSupabase();

    // Identité : la fiche liée au jeton.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, status")
      .eq("clerk_user_id", caller.actorId)
      .eq("role", "formateur")
      .maybeSingle();
    if (!profile || profile.status !== "actif") {
      return failDeparture(
        "Votre compte n'est pas actif. Contactez l'administration.",
      );
    }

    const { data, error } = await admin.rpc("record_departure", {
      p_profile_id: profile.id,
      p_attendance_id: attendanceId,
      p_code: code,
    });
    const verdict = data?.[0];
    if (error || !verdict) {
      console.error(
        "record_departure :",
        error?.message ?? "réponse inattendue",
      );
      return ERREUR_DESCENTE;
    }

    revalidatePath("/formateur");
    revalidatePath(`/formateur/cahiers/${attendanceId}`);

    const outcome = verdict.out_outcome;
    if (outcome === "ok" || outcome === "already") {
      const at = formatClock(verdict.out_departed_at);
      return {
        ok: true,
        departedAt: verdict.out_departed_at,
        message:
          outcome === "ok"
            ? `Descente enregistrée à ${at}. Vous pouvez envoyer votre rapport.`
            : `Votre descente est déjà enregistrée (${at}).`,
      };
    }
    if (outcome === "too_early") {
      const minutes = verdict.out_minutes_left;
      return failDeparture(
        `Le code n'est pas encore accepté : le cours se termine dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
      );
    }
    if (outcome === "expired") {
      return failDeparture(
        "Le jour du cours est passé : contactez la Direction pédagogique pour valider votre descente.",
      );
    }
    if (outcome === "not_required") {
      return failDeparture("Ce pointage n'a pas de descente à valider.");
    }
    if (outcome === "not_found") {
      return failDeparture("Pointage introuvable.");
    }
    if (isCodeOutcome(outcome)) {
      const problem = codeOutcomeMessage(outcome, {
        remaining: verdict.out_remaining,
        minutesLeft: verdict.out_minutes_left,
      });
      return failDeparture(problem ?? "Code refusé.");
    }
    console.error("record_departure : issue inconnue", outcome);
    return ERREUR_DESCENTE;
  } catch (error) {
    console.error("submitDeparture :", error);
    return ERREUR_DESCENTE;
  }
}
