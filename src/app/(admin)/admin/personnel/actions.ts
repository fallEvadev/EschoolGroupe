"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { assignableRoles, type Role } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  profileIdSchema,
  staffNoteSchema,
  staffSchema,
  type StaffData,
  type StaffResult,
} from "@/lib/validations/staff";

const RH_ROLES = ["admin_rh", "super_admin"] as const;

const ERREUR_GENERIQUE: StaffResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

/** Code PostgreSQL d'une valeur en double (ici : l'adresse e-mail). */
const UNIQUE_VIOLATION = "23505";

/** Adresse du site (pour le lien d'activation envoyé par Clerk). */
async function appUrl(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  const protocol = list.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

/** Colonnes de `profiles` correspondant aux champs du formulaire. */
function toRow(data: StaffData) {
  return {
    full_name: `${data.firstName} ${data.lastName}`,
    phone: data.phone,
    role: data.role,
    job_title: data.jobTitle,
    contract_type: data.contractType,
    hire_date: data.hireDate,
  };
}

/**
 * Envoie (ou renvoie) l'invitation Clerk et l'enregistre sur la fiche.
 * Le rôle voyage dans l'invitation : Clerk le copie dans le compte créé.
 */
async function sendInvitation(
  profileId: string,
  email: string,
  role: Role,
  previousInvitationId: string | null,
) {
  const client = await clerkClient();
  if (previousInvitationId) {
    // L'ancien lien ne doit plus fonctionner (il peut déjà être expiré).
    await client.invitations
      .revokeInvitation(previousInvitationId)
      .catch(() => undefined);
  }
  const invitation = await client.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: { role },
    redirectUrl: `${await appUrl()}/activation`,
    expiresInDays: 7,
  });

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      invitation_id: invitation.id,
      invited_at: new Date().toISOString(),
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

/** Vrai si un compte Clerk existe déjà avec cette adresse. */
async function clerkAccountExists(email: string): Promise<boolean> {
  const client = await clerkClient();
  const { totalCount } = await client.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  return totalCount > 0;
}

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
    // Un compte existant se gère depuis « Accès & rôles », pas par invitation.
    if (await clerkAccountExists(data.email)) {
      return {
        ok: false,
        message:
          "Un compte existe déjà avec cette adresse e-mail. Son rôle se gère depuis « Accès & rôles ».",
      };
    }

    const supabase = await createServerSupabase();
    const { data: created, error } = await supabase
      .from("profiles")
      .insert({
        ...toRow(data),
        email: data.email,
        status: "invite",
        created_by: caller.actorId,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return {
          ok: false,
          message: "Une fiche existe déjà avec cette adresse e-mail.",
        };
      }
      console.error("profiles :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "staff_created",
      entity: "profiles",
      entityId: created.id,
      details: { email: data.email, role: data.role },
    });
    revalidatePath("/admin/personnel");

    try {
      await sendInvitation(created.id, data.email, data.role, null);
    } catch (error) {
      console.error("invitation :", error);
      return {
        ok: false,
        id: created.id,
        message:
          "Fiche créée, mais l'invitation n'a pas pu être envoyée. Utilisez « Renvoyer l'invitation » sur la fiche.",
      };
    }

    return {
      ok: true,
      id: created.id,
      message: `Fiche créée. Une invitation a été envoyée à ${data.email}.`,
    };
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
      .update(toRow(data))
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
    const supabase = await createServerSupabase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, role, status, invitation_id")
      .eq("id", profileId)
      .maybeSingle();
    if (!profile) return { ok: false, message: "Fiche introuvable." };
    if (profile.status !== "invite") {
      return { ok: false, message: "Ce compte est déjà activé." };
    }
    if (!assignableRoles(caller.role).includes(profile.role)) {
      return { ok: false, message: "Vous ne pouvez pas gérer cette fiche." };
    }

    await sendInvitation(
      profileId,
      profile.email,
      profile.role,
      profile.invitation_id,
    );
    await writeAudit({
      actorId: caller.actorId,
      action: "invitation_resent",
      entity: "profiles",
      entityId: profileId,
      details: { email: profile.email },
    });

    revalidatePath("/admin/personnel");
    return { ok: true, message: `Invitation renvoyée à ${profile.email}.` };
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
