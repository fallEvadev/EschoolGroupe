"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  reviewReportSchema,
  type ReviewResult,
} from "@/lib/validations/reports";

import { PEDAGOGY_ROLES } from "../ecoles/access";

/** Codes PostgreSQL dont le message, écrit en français dans la base, est lisible. */
const READABLE_ERRORS = new Set(["42501", "P0002", "22023", "23514"]);

const ERREUR_GENERIQUE: ReviewResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

const SUCCESS_MESSAGES = {
  valide: "Rapport validé.",
  valide_avec_corrections: "Rapport validé avec corrections.",
  a_modifier: "Modification demandée au formateur.",
} as const;

/**
 * Décision de la Direction sur un rapport envoyé. Tout passe par le jeton de
 * l'utilisateur et la fonction SQL `review_daily_report` (une transaction :
 * statut, contenu corrigé, historique) ; la RLS et le déclencheur de la base
 * revérifient le rôle et les transitions.
 */
export async function reviewReport(input: unknown): Promise<ReviewResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = reviewReportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { reportId, decision, comment, corrections } = parsed.data;

  try {
    const supabase = await createServerSupabase();

    // Pour un journal d'audit lisible : formateur, école et date.
    const { data: report } = await supabase
      .from("daily_reports")
      .select("profile_id, school_id, report_date")
      .eq("id", reportId)
      .maybeSingle();
    if (!report) return { ok: false, message: "Rapport introuvable." };

    const { error } = await supabase.rpc("review_daily_report", {
      p_report_id: reportId,
      p_decision: decision,
      p_comment: comment || undefined,
      p_classes: corrections?.classes,
      p_course_theme: corrections?.courseTheme,
      p_equipment_ok: corrections?.equipmentOk,
      p_equipment_issues: corrections?.issues,
    });
    if (error) {
      if (error.code && READABLE_ERRORS.has(error.code)) {
        return { ok: false, message: error.message };
      }
      console.error("review_daily_report :", error.message);
      return ERREUR_GENERIQUE;
    }

    const [directory, school] = await Promise.all([
      supabase.rpc("pedagogy_staff_directory"),
      supabase
        .from("schools")
        .select("name")
        .eq("id", report.school_id)
        .maybeSingle(),
    ]);
    await writeAudit({
      actorId: caller.actorId,
      action: "report_reviewed",
      entity: "daily_reports",
      entityId: reportId,
      // Le commentaire et le contenu restent dans `report_revisions` : le
      // journal dit qui a décidé quoi, pas le texte (il peut être sensible).
      details: {
        decision,
        date: report.report_date,
        formateur:
          directory.data?.find((p) => p.id === report.profile_id)?.full_name ??
          "Formateur inconnu",
        school: school.data?.name ?? "École inconnue",
      },
    });

    revalidatePath("/admin/rapports");
    revalidatePath("/formateur/cahiers");
    return { ok: true, message: SUCCESS_MESSAGES[decision] };
  } catch (error) {
    console.error("reviewReport :", error);
    return ERREUR_GENERIQUE;
  }
}
