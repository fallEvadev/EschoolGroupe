"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { parseRole } from "@/lib/auth/roles";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  setActiveSchema,
  updateRoleSchema,
  type AccessResult,
} from "@/lib/validations/access";

const ERREUR_GENERIQUE: AccessResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

export async function updateUserRole(input: unknown): Promise<AccessResult> {
  const caller = await requireSuperAdmin();
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { userId, role } = parsed.data;

  if (userId === caller.actorId) {
    return {
      ok: false,
      message: "Vous ne pouvez pas modifier votre propre rôle.",
    };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const previousRole = parseRole(user.publicMetadata?.role);

    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role },
    });

    const email = user.primaryEmailAddress?.emailAddress ?? "";
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || email;

    const { error } = await createAdminSupabase().from("profiles").upsert(
      {
        clerk_user_id: userId,
        email,
        full_name: fullName,
        role,
      },
      { onConflict: "clerk_user_id" },
    );

    await writeAudit({
      actorId: caller.actorId,
      action: "role_changed",
      entity: "profiles",
      entityId: userId,
      details: { from: previousRole, to: role },
    });

    revalidatePath("/admin/acces");

    if (error) {
      console.error("profiles :", error.message);
      return {
        ok: false,
        message:
          "Rôle modifié dans Clerk, mais la synchronisation du profil a échoué. Réessayez.",
      };
    }
    return {
      ok: true,
      message:
        "Rôle enregistré. La personne doit se reconnecter pour qu'il soit pris en compte.",
    };
  } catch (error) {
    console.error("updateUserRole :", error);
    return ERREUR_GENERIQUE;
  }
}

export async function setUserActive(input: unknown): Promise<AccessResult> {
  const caller = await requireSuperAdmin();
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { userId, active } = parsed.data;

  if (userId === caller.actorId) {
    return {
      ok: false,
      message: "Vous ne pouvez pas désactiver votre propre compte.",
    };
  }

  try {
    const client = await clerkClient();
    // Aucune suppression : on bloque ou on rétablit la connexion.
    if (active) await client.users.unbanUser(userId);
    else await client.users.banUser(userId);

    const { error } = await createAdminSupabase()
      .from("profiles")
      .update({ status: active ? "actif" : "inactif" })
      .eq("clerk_user_id", userId);

    await writeAudit({
      actorId: caller.actorId,
      action: active ? "account_reactivated" : "account_deactivated",
      entity: "profiles",
      entityId: userId,
      details: { active },
    });

    revalidatePath("/admin/acces");

    if (error) {
      console.error("profiles :", error.message);
      return {
        ok: false,
        message:
          "Compte mis à jour dans Clerk, mais la synchronisation du profil a échoué.",
      };
    }
    return {
      ok: true,
      message: active ? "Compte réactivé." : "Compte désactivé.",
    };
  } catch (error) {
    console.error("setUserActive :", error);
    return ERREUR_GENERIQUE;
  }
}
