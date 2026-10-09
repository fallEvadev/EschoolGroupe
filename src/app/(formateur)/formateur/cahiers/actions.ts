"use server";

import { revalidatePath } from "next/cache";

import { requireActionRole } from "@/lib/auth/action-guard";
import { writeAudit } from "@/lib/audit";
import { isReportStatus, isEditable } from "@/lib/reports";
import { createServerSupabase } from "@/lib/supabase/server";
import { reportSchema, type ReportResult } from "@/lib/validations/reports";

/** Code PostgreSQL d'une valeur en double (ici : un rapport existe déjà). */
const UNIQUE_VIOLATION = "23505";
/** Code PostgreSQL d'une contrainte ou d'une règle de la base refusée. */
const CHECK_VIOLATION = "23514";
/** Code PostgreSQL d'une politique RLS qui refuse l'écriture. */
const RLS_VIOLATION = "42501";

const ERREUR_GENERIQUE: ReportResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

function fail(message: string): ReportResult {
  return { ok: false, message };
}

/**
 * Enregistre (brouillon) ou envoie (`submit`) le rapport du formateur connecté.
 *
 * Tout passe par SON jeton : la RLS et le déclencheur de la base font le
 * second contrôle (propriétaire, statut modifiable, pointage non refusé, rapport
 * validé verrouillé). L'identité, l'école, le créneau et la date viennent du
 * pointage, jamais du navigateur.
 */
export async function saveReport(input: unknown): Promise<ReportResult> {
  const caller = await requireActionRole(["formateur"]);
  if (!caller.ok) return fail(caller.message);

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  }
  const data = parsed.data;

  try {
    const supabase = await createServerSupabase();

    // Le pointage : visible seulement s'il est le nôtre (RLS).
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendances")
      .select("id, profile_id, school_id, slot_id, attendance_date")
      .eq("id", data.attendanceId)
      .maybeSingle();
    if (attendanceError) {
      console.error("attendances :", attendanceError.message);
      return ERREUR_GENERIQUE;
    }
    if (!attendance) return fail("Pointage introuvable.");

    const fields = {
      classes: data.classes,
      course_theme: data.courseTheme,
      equipment_ok: data.equipmentOk,
      equipment_issues: data.issues,
    };

    const { data: existing, error: existingError } = await supabase
      .from("daily_reports")
      .select("id, status")
      .eq("attendance_id", attendance.id)
      .maybeSingle();
    if (existingError) {
      console.error("daily_reports :", existingError.message);
      return ERREUR_GENERIQUE;
    }

    let reportId: string;
    if (existing) {
      if (!isReportStatus(existing.status) || !isEditable(existing.status)) {
        return fail("Ce rapport n'est plus modifiable.");
      }
      const { error } = await supabase
        .from("daily_reports")
        .update(fields)
        .eq("id", existing.id);
      if (error) return mapWriteError(error);
      reportId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("daily_reports")
        .insert({
          ...fields,
          attendance_id: attendance.id,
          profile_id: attendance.profile_id,
          school_id: attendance.school_id,
          slot_id: attendance.slot_id,
          report_date: attendance.attendance_date,
        })
        .select("id")
        .single();
      if (error) return mapWriteError(error);
      reportId = created.id;
    }

    if (data.submit) {
      // Passage à « soumis » + historique dans une seule transaction SQL.
      const { error } = await supabase.rpc("submit_daily_report", {
        p_report_id: reportId,
      });
      if (error) return mapWriteError(error);
      // Pas de texte libre dans l'audit : seulement l'identifiant du rapport.
      await writeAudit({
        actorId: caller.actorId,
        action: "report_submitted",
        entity: "daily_reports",
        entityId: reportId,
        details: {},
      });
    }

    revalidatePath("/formateur/cahiers");
    return {
      ok: true,
      reportId,
      submitted: data.submit,
      message: data.submit
        ? "Rapport envoyé à la Direction."
        : "Brouillon enregistré.",
    };
  } catch (error) {
    console.error("saveReport :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Traduit une erreur d'écriture de la base en message clair pour le formateur. */
function mapWriteError(error: {
  code?: string;
  message: string;
}): ReportResult {
  if (error.code === UNIQUE_VIOLATION) {
    return fail("Un rapport existe déjà pour ce pointage. Rechargez la page.");
  }
  if (error.code === CHECK_VIOLATION) {
    return fail("Ce rapport n'est plus modifiable.");
  }
  if (error.code === RLS_VIOLATION) {
    return fail(
      "Vous ne pouvez pas rédiger de rapport pour ce pointage (pointage refusé par la Direction ?).",
    );
  }
  console.error("daily_reports :", error.message);
  return ERREUR_GENERIQUE;
}
