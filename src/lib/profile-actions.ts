"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { myPhoneSchema, type ProfileResult } from "@/lib/validations/profile";

/** Rôles qui ont une page « Profil » et peuvent changer leur numéro. */
const PROFILE_ROLES = ["formateur", "maintenancier"] as const;

/**
 * Change le téléphone de la personne connectée. Seule la colonne `phone` de SA
 * fiche est modifiée, par la fonction SQL `set_my_phone` (qui revérifie le rôle
 * et le format) : le reste de la fiche reste réservé aux RH. Le numéro n'est
 * pas copié dans le journal d'audit.
 */
export async function updateMyPhone(input: unknown): Promise<ProfileResult> {
  const caller = await requireActionRole(PROFILE_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = myPhoneSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Numéro invalide.",
    };
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.rpc("set_my_phone", {
      p_phone: parsed.data.phone ?? "",
    });
    if (error) {
      console.error("set_my_phone :", error.message);
      return {
        ok: false,
        message: "Le numéro n'a pas pu être enregistré. Réessayez.",
      };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "phone_updated",
      entity: "profiles",
      entityId: caller.actorId,
      details: {},
    });
    revalidatePath("/formateur/profil");
    revalidatePath("/maintenance/profil");
    return {
      ok: true,
      message: parsed.data.phone ? "Numéro enregistré." : "Numéro effacé.",
    };
  } catch (error) {
    console.error("updateMyPhone :", error);
    return { ok: false, message: "Une erreur est survenue. Réessayez." };
  }
}
