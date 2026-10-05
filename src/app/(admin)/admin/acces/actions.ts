"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { parseRole } from "@/lib/auth/roles";
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

/**
 * Vérifie que l'appelant est bien Super-Admin. Sans cela, n'importe quel
 * utilisateur connecté pourrait appeler cette action : le contrôle de la page
 * ne suffit pas (règle du double contrôle).
 */
async function requireSuperAdmin(): Promise<
  { ok: true; actorId: string } | { ok: false; result: AccessResult }
> {
  const { userId, sessionClaims } = await auth();
  const role = parseRole(sessionClaims?.user_role);
  if (!userId || role !== "super_admin") {
    return {
      ok: false,
      result: { ok: false, message: "Action réservée au Super-Admin." },
    };
  }
  return { ok: true, actorId: userId };
}

/** Écrit une ligne dans le journal d'audit (ne bloque jamais l'action). */
async function writeAudit(
  actorId: string,
  action: string,
  targetId: string,
  details: Record<string, string | boolean | null>,
) {
  const { error } = await createAdminSupabase().from("audit_log").insert({
    actor_clerk_id: actorId,
    action,
    entity: "profiles",
    entity_id: targetId,
    details,
  });
  if (error) console.error("audit_log :", error.message);
}

export async function updateUserRole(input: unknown): Promise<AccessResult> {
  const caller = await requireSuperAdmin();
  if (!caller.ok) return caller.result;

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

    await writeAudit(caller.actorId, "role_changed", userId, {
      from: previousRole,
      to: role,
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
  if (!caller.ok) return caller.result;

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

    await writeAudit(
      caller.actorId,
      active ? "account_reactivated" : "account_deactivated",
      userId,
      { active },
    );

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
