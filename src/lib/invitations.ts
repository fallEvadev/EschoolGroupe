import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";

import { resolveAppUrl } from "@/lib/app-url";
import { writeAudit } from "@/lib/audit";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { getOrganizationSettings } from "@/lib/organization";
import { splitFullName } from "@/lib/staff";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  ShareInfo,
  StaffData,
  StaffResult,
} from "@/lib/validations/staff";
import { buildWhatsAppUrl, invitationMessage } from "@/lib/whatsapp";

/** Durée de validité d'une invitation. */
export const INVITATION_VALID_DAYS = 7;

/** Code PostgreSQL d'une valeur en double (ici : l'adresse e-mail). */
const UNIQUE_VIOLATION = "23505";

export const ERREUR_GENERIQUE: StaffResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

/**
 * Adresse du site (pour le lien d'activation envoyé par Clerk). Vient de
 * `NEXT_PUBLIC_APP_URL` quand elle est définie ; sinon des en-têtes de la
 * requête, qui ne sont pas fiables : la définir en production.
 */
async function appUrl(): Promise<string> {
  const list = await headers();
  return resolveAppUrl({
    configured: process.env.NEXT_PUBLIC_APP_URL,
    host: list.get("x-forwarded-host") ?? list.get("host"),
    forwardedProto: list.get("x-forwarded-proto"),
  });
}

/** Colonnes de `profiles` correspondant aux champs du formulaire. */
export function toProfileRow(data: StaffData) {
  return {
    full_name: `${data.firstName} ${data.lastName}`,
    phone: data.phone,
    role: data.role,
    job_title: data.jobTitle,
    contract_type: data.contractType,
    hire_date: data.hireDate,
  };
}

/** Vrai si un compte Clerk existe déjà avec cette adresse. */
export async function clerkAccountExists(email: string): Promise<boolean> {
  const client = await clerkClient();
  const { totalCount } = await client.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  return totalCount > 0;
}

/**
 * Envoie (ou renvoie) l'invitation Clerk par e-mail et l'enregistre sur la
 * fiche. Le rôle voyage dans l'invitation : Clerk le copie dans le compte
 * créé. Renvoie le lien d'activation, à partager aussi par WhatsApp.
 */
export async function sendInvitation(
  profileId: string,
  email: string,
  role: Role,
  previousInvitationId: string | null,
): Promise<string | null> {
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
    expiresInDays: INVITATION_VALID_DAYS,
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

  return invitation.url ?? null;
}

/** Lien WhatsApp avec le message d'invitation déjà rédigé. */
export async function buildShare({
  url,
  phone,
  fullName,
  role,
}: {
  url: string;
  phone: string | null;
  fullName: string;
  role: Role;
}): Promise<ShareInfo> {
  const settings = await getOrganizationSettings();
  const text = invitationMessage({
    firstName: splitFullName(fullName).firstName || fullName,
    organizationName: settings?.organizationName ?? "E-School Groupe",
    roleLabel: ROLE_LABELS[role],
    url,
    validDays: INVITATION_VALID_DAYS,
  });
  return {
    url,
    whatsappUrl: buildWhatsAppUrl(phone, text),
    recipient: fullName,
  };
}

/**
 * Crée la fiche d'une recrue (statut « invite ») puis envoie l'invitation.
 * L'appelant a déjà vérifié son rôle et le rôle attribué.
 */
export async function createProfileWithInvitation(
  actorId: string,
  data: StaffData,
): Promise<StaffResult> {
  // Un compte existant se gère depuis « Accès & rôles », pas par invitation.
  if (await clerkAccountExists(data.email)) {
    return {
      ok: false,
      message:
        "Un compte existe déjà avec cette adresse e-mail. Son rôle se modifie dans la liste des comptes.",
    };
  }

  const supabase = await createServerSupabase();
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      ...toProfileRow(data),
      email: data.email,
      status: "invite",
      created_by: actorId,
    })
    .select("id, full_name")
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
    actorId,
    action: "staff_created",
    entity: "profiles",
    entityId: created.id,
    details: { email: data.email, role: data.role },
  });

  let url: string | null;
  try {
    url = await sendInvitation(created.id, data.email, data.role, null);
  } catch (error) {
    console.error("invitation :", error);
    return {
      ok: false,
      id: created.id,
      message:
        "Fiche créée, mais l'invitation n'a pas pu être envoyée. Utilisez « Renvoyer l'invitation ».",
    };
  }

  return {
    ok: true,
    id: created.id,
    message: `Accès créé. Une invitation a été envoyée à ${data.email}.`,
    share: url
      ? await buildShare({
          url,
          phone: data.phone,
          fullName: created.full_name,
          role: data.role,
        })
      : undefined,
  };
}

/**
 * Renvoie l'invitation d'une fiche encore « invite » (l'ancien lien est
 * annulé) et prépare le partage WhatsApp. `canManage` : le rôle de la fiche
 * est-il gérable par l'appelant ?
 */
export async function resendProfileInvitation(
  actorId: string,
  profileId: string,
  canManage: (role: Role) => boolean,
): Promise<StaffResult> {
  const supabase = await createServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role, status, invitation_id, full_name, phone")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return { ok: false, message: "Fiche introuvable." };
  if (profile.status !== "invite") {
    return { ok: false, message: "Ce compte est déjà activé." };
  }
  if (!canManage(profile.role)) {
    return { ok: false, message: "Vous ne pouvez pas gérer cette fiche." };
  }

  const url = await sendInvitation(
    profileId,
    profile.email,
    profile.role,
    profile.invitation_id,
  );
  await writeAudit({
    actorId,
    action: "invitation_resent",
    entity: "profiles",
    entityId: profileId,
    details: { email: profile.email },
  });

  return {
    ok: true,
    id: profileId,
    message: `Nouvelle invitation envoyée à ${profile.email}.`,
    share: url
      ? await buildShare({
          url,
          phone: profile.phone,
          fullName: profile.full_name,
          role: profile.role,
        })
      : undefined,
  };
}
