"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  organizationSettingsSchema,
  type SettingsResult,
} from "@/lib/validations/settings";

export async function updateOrganizationSettings(
  input: unknown,
): Promise<SettingsResult> {
  const caller = await requireSuperAdmin();
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { organizationName, academicYear, currentSemester } = parsed.data;

  try {
    // Client avec le jeton de l'utilisateur : la RLS revérifie le rôle.
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("organization_settings")
      .update({
        organization_name: organizationName,
        academic_year: academicYear,
        current_semester: currentSemester,
        updated_by: caller.actorId,
      })
      .eq("id", true)
      .select("id");

    if (error) {
      console.error("organization_settings :", error.message);
      return {
        ok: false,
        message: "Enregistrement impossible. Réessayez dans un instant.",
      };
    }
    // Refus de la RLS : aucune erreur, mais aucune ligne modifiée.
    if (data.length === 0) {
      return {
        ok: false,
        message:
          "Modification refusée par la base : vérifiez la liaison Clerk ↔ Supabase.",
      };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "settings_updated",
      entity: "organization_settings",
      entityId: null,
      details: {
        organization_name: organizationName,
        academic_year: academicYear,
        current_semester: currentSemester,
      },
    });

    // Rafraîchit aussi l'en-tête (année, semestre) de tout l'espace admin.
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Paramètres enregistrés." };
  } catch (error) {
    console.error("updateOrganizationSettings :", error);
    return {
      ok: false,
      message: "Une erreur est survenue. Réessayez dans un instant.",
    };
  }
}
