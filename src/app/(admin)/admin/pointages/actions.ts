"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { loadSheetData } from "@/lib/attendance-data";
import { buildSheet, canExcuse } from "@/lib/attendance-sheet";
import { dakarIsoDate, formatDate } from "@/lib/dates";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  closeDaySchema,
  closedDayIdSchema,
  excuseAbsenceSchema,
  excuseIdSchema,
  reviewAttendanceSchema,
  type FollowUpResult,
} from "@/lib/validations/attendance-follow-up";

import { PEDAGOGY_ROLES } from "../ecoles/access";

/** Code PostgreSQL d'une valeur en double. */
const UNIQUE_VIOLATION = "23505";
/** Code PostgreSQL d'une règle de la base non respectée (contrainte, déclencheur). */
const CHECK_VIOLATION = "23514";

const ERREUR_GENERIQUE: FollowUpResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

function invalid(error: { issues: { message: string }[] }): FollowUpResult {
  return {
    ok: false,
    message: error.issues[0]?.message ?? "Données invalides.",
  };
}

function refresh() {
  revalidatePath("/admin/pointages");
  // Le formateur lit la décision et l'excuse sur son accueil.
  revalidatePath("/formateur");
}

/** Nom d'un formateur et d'une école, pour des lignes d'audit lisibles. */
async function namesFor(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  profileId: string,
  schoolId: string | null,
): Promise<{ formateur: string; school: string }> {
  const [directory, school] = await Promise.all([
    supabase.rpc("pedagogy_staff_directory"),
    schoolId
      ? supabase.from("schools").select("name").eq("id", schoolId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    formateur:
      directory.data?.find((person) => person.id === profileId)?.full_name ??
      "Formateur inconnu",
    school: schoolId
      ? (school.data?.name ?? "École inconnue")
      : "Toutes les écoles",
  };
}

/** Valide ou refuse un pointage « à vérifier » (le refus exige un motif). */
export async function reviewAttendance(
  input: unknown,
): Promise<FollowUpResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = reviewAttendanceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { attendanceId, decision, comment } = parsed.data;

  try {
    // Client avec le jeton de l'utilisateur : la RLS revérifie le rôle.
    const supabase = await createServerSupabase();
    const { data: attendance } = await supabase
      .from("attendances")
      .select("profile_id, school_id, attendance_date, status")
      .eq("id", attendanceId)
      .maybeSingle();
    if (!attendance) return { ok: false, message: "Pointage introuvable." };
    if (attendance.status !== "a_verifier") {
      return {
        ok: false,
        message: "Seul un pointage à vérifier peut être traité.",
      };
    }

    const { error } = await supabase.from("attendance_reviews").upsert(
      {
        attendance_id: attendanceId,
        decision,
        comment: comment || null,
        reviewed_by: caller.actorId,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "attendance_id" },
    );
    if (error) {
      if (error.code === CHECK_VIOLATION) {
        return { ok: false, message: error.message };
      }
      console.error("attendance_reviews :", error.message);
      return ERREUR_GENERIQUE;
    }

    const names = await namesFor(
      supabase,
      attendance.profile_id,
      attendance.school_id,
    );
    await writeAudit({
      actorId: caller.actorId,
      action: "attendance_reviewed",
      entity: "attendances",
      entityId: attendanceId,
      details: {
        decision,
        date: attendance.attendance_date,
        formateur: names.formateur,
        school: names.school,
        comment: comment || null,
      },
    });
    refresh();
    return {
      ok: true,
      message:
        decision === "valide"
          ? "Pointage validé."
          : "Pointage refusé : il compte comme une absence.",
    };
  } catch (error) {
    console.error("reviewAttendance :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Excuse une absence (ou un pointage refusé) avec un motif. */
export async function excuseAbsence(input: unknown): Promise<FollowUpResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = excuseAbsenceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { profileId, slotId, date, reason } = parsed.data;

  const now = new Date();
  if (date > dakarIsoDate(now)) {
    return { ok: false, message: "On n'excuse pas une absence à venir." };
  }

  try {
    const supabase = await createServerSupabase();

    // L'absence doit être réelle : on reconstruit la feuille de ce jour.
    const data = await loadSheetData(supabase, { from: date, to: date });
    if ("error" in data) return { ok: false, message: data.error };
    const row = buildSheet({
      date,
      now,
      slots: data.slots,
      assignments: data.assignments,
      attendances: data.attendances,
      reviews: data.reviews,
      excuses: data.excuses,
      closedDays: data.closedDays,
    }).find((r) => r.profileId === profileId && r.slotId === slotId);
    if (!row || !canExcuse(row.state)) {
      return {
        ok: false,
        message:
          "Cette absence n'existe pas ou ne peut plus être excusée. Actualisez la page.",
      };
    }

    const { error } = await supabase.from("absence_excuses").insert({
      profile_id: profileId,
      slot_id: slotId,
      absence_date: date,
      reason,
      created_by: caller.actorId,
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { ok: false, message: "Cette absence est déjà excusée." };
      }
      console.error("absence_excuses :", error.message);
      return ERREUR_GENERIQUE;
    }

    const names = await namesFor(supabase, profileId, row.schoolId);
    await writeAudit({
      actorId: caller.actorId,
      action: "absence_excused",
      entity: "time_slots",
      entityId: slotId,
      details: {
        date,
        formateur: names.formateur,
        school: names.school,
        reason,
      },
    });
    refresh();
    return { ok: true, message: "Absence excusée." };
  } catch (error) {
    console.error("excuseAbsence :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Annule une excuse (elle est archivée : l'absence redevient comptée). */
export async function cancelExcuse(input: unknown): Promise<FollowUpResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = excuseIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { excuseId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("absence_excuses")
      .update({ status: "archive" })
      .eq("id", excuseId)
      .eq("status", "actif")
      .select("profile_id, slot_id, absence_date");
    if (error) {
      console.error("absence_excuses :", error.message);
      return ERREUR_GENERIQUE;
    }
    const excuse = updated[0];
    if (!excuse) return { ok: false, message: "Cette excuse n'existe plus." };

    await writeAudit({
      actorId: caller.actorId,
      action: "excuse_cancelled",
      entity: "time_slots",
      entityId: excuse.slot_id,
      details: { date: excuse.absence_date, profile_id: excuse.profile_id },
    });
    refresh();
    return {
      ok: true,
      message: "Excuse annulée : l'absence est de nouveau comptée.",
    };
  } catch (error) {
    console.error("cancelExcuse :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Marque un jour « sans cours » (toutes les écoles ou une seule). */
export async function closeDay(input: unknown): Promise<FollowUpResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = closeDaySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, schoolId, reason } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("closed_days").insert({
      closed_date: date,
      school_id: schoolId,
      reason,
      created_by: caller.actorId,
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return {
          ok: false,
          message: "Ce jour est déjà marqué sans cours pour cette portée.",
        };
      }
      console.error("closed_days :", error.message);
      return ERREUR_GENERIQUE;
    }

    const names = await namesFor(supabase, "", schoolId);
    await writeAudit({
      actorId: caller.actorId,
      action: "day_closed",
      entity: "closed_days",
      entityId: null,
      details: { date, school: names.school, reason },
    });
    refresh();
    return {
      ok: true,
      message: `${formatDate(date)} est marqué sans cours : aucune absence n'est comptée ce jour-là.`,
    };
  } catch (error) {
    console.error("closeDay :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Rouvre un jour « sans cours » (la fermeture est archivée). */
export async function reopenDay(input: unknown): Promise<FollowUpResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = closedDayIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { closedDayId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("closed_days")
      .update({ status: "archive" })
      .eq("id", closedDayId)
      .eq("status", "actif")
      .select("closed_date, school_id");
    if (error) {
      console.error("closed_days :", error.message);
      return ERREUR_GENERIQUE;
    }
    const closed = updated[0];
    if (!closed) return { ok: false, message: "Ce jour n'est plus fermé." };

    const names = await namesFor(supabase, "", closed.school_id);
    await writeAudit({
      actorId: caller.actorId,
      action: "day_reopened",
      entity: "closed_days",
      entityId: closedDayId,
      details: { date: closed.closed_date, school: names.school },
    });
    refresh();
    return {
      ok: true,
      message: "Jour rouvert : les absences sont de nouveau comptées.",
    };
  } catch (error) {
    console.error("reopenDay :", error);
    return ERREUR_GENERIQUE;
  }
}
