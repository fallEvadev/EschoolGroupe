"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { assignableRoles, type Role } from "@/lib/auth/roles";
import {
  createProfileWithInvitation,
  ERREUR_GENERIQUE,
  resendProfileInvitation,
  sendInvitation,
  toProfileRow,
} from "@/lib/invitations";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  profileIdSchema,
  staffNoteSchema,
  staffSchema,
  type StaffData,
  type StaffResult,
} from "@/lib/validations/staff";

const RH_ROLES = ["admin_rh", "super_admin"] as const;

/** Valide le formulaire et vérifie que l'appelant peut attribuer le rôle. */
function parseStaff(
  input: unknown,
  callerRole: Role,
): { ok: true; data: StaffData } | { ok: false; result: StaffResult } {
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      result: {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Données invalides.",
      },
    };
  }
  if (!assignableRoles(callerRole).includes(parsed.data.role)) {
    return {
      ok: false,
      result: { ok: false, message: "Vous ne pouvez pas attribuer ce rôle." },
    };
  }
  return { ok: true, data: parsed.data };
}

export async function createStaffMember(input: unknown): Promise<StaffResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = parseStaff(input, caller.role);
  if (!parsed.ok) return parsed.result;
  const { data } = parsed;

  try {
    const result = await createProfileWithInvitation(caller.actorId, data);
    revalidatePath("/admin/personnel");
    return result;
  } catch (error) {
    console.error("createStaffMember :", error);
    return ERREUR_GENERIQUE;
  }
}

export async function updateStaffMember(
  profileId: string,
  input: unknown,
): Promise<StaffResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const id = profileIdSchema.safeParse({ profileId });
  if (!id.success) return { ok: false, message: "Fiche invalide." };

  const parsed = parseStaff(input, caller.role);
  if (!parsed.ok) return parsed.result;
  const { data } = parsed;

  try {
    const supabase = await createServerSupabase();
    const { data: current } = await supabase
      .from("profiles")
      .select("email, role, status, clerk_user_id, invitation_id")
      .eq("id", profileId)
      .maybeSingle();
    if (!current) return { ok: false, message: "Fiche introuvable." };

    // L'e-mail est l'identifiant de connexion : il ne change pas ici.
    if (current.email.toLowerCase() !== data.email) {
      return {
        ok: false,
        message: "L'adresse e-mail ne peut pas être modifiée.",
      };
    }

    // La RLS refuse sans erreur (aucune ligne) une fiche hors de vos droits.
    const { data: updated, error } = await supabase
      .from("profiles")
      .update(toProfileRow(data))
      .eq("id", profileId)
      .select("id");
    if (error) {
      console.error("profiles :", error.message);
      return ERREUR_GENERIQUE;
    }
    if (updated.length === 0) {
      return { ok: false, message: "Vous ne pouvez pas modifier cette fiche." };
    }

    const roleChanged = current.role !== data.role;
    if (roleChanged && current.clerk_user_id) {
      // Compte actif : le rôle est lu dans Clerk à la prochaine connexion.
      const client = await clerkClient();
      await client.users.updateUserMetadata(current.clerk_user_id, {
        publicMetadata: { role: data.role },
      });
    } else if (roleChanged && current.status === "invite") {
      // Invitation en cours : on la remplace pour transmettre le bon rôle.
      await sendInvitation(
        profileId,
        current.email,
        data.role,
        current.invitation_id,
      );
    }

    await writeAudit({
      actorId: caller.actorId,
      action: roleChanged ? "role_changed" : "staff_updated",
      entity: "profiles",
      entityId: profileId,
      details: roleChanged ? { from: current.role, to: data.role } : {},
    });

    revalidatePath("/admin/personnel");
    return { ok: true, id: profileId, message: "Fiche mise à jour." };
  } catch (error) {
    console.error("updateStaffMember :", error);
    return ERREUR_GENERIQUE;
  }
}

export async function resendInvitation(input: unknown): Promise<StaffResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = profileIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Fiche invalide." };
  const { profileId } = parsed.data;

  try {
    const result = await resendProfileInvitation(
      caller.actorId,
      profileId,
      (role) => assignableRoles(caller.role).includes(role),
    );
    revalidatePath("/admin/personnel");
    return result;
  } catch (error) {
    console.error("resendInvitation :", error);
    return ERREUR_GENERIQUE;
  }
}

export async function saveStaffNote(input: unknown): Promise<StaffResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = staffNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("staff_notes").upsert(
      {
        profile_id: parsed.data.profileId,
        content: parsed.data.content,
        updated_by: caller.actorId,
      },
      { onConflict: "profile_id" },
    );
    if (error) {
      console.error("staff_notes :", error.message);
      return ERREUR_GENERIQUE;
    }
    revalidatePath("/admin/personnel");
    return { ok: true, message: "Note enregistrée." };
  } catch (error) {
    console.error("saveStaffNote :", error);
    return ERREUR_GENERIQUE;
  }
}
