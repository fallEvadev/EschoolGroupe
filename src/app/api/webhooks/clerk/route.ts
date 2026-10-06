import type { UserJSON } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { writeAudit } from "@/lib/audit";
import { parseRole } from "@/lib/auth/roles";
import { primaryEmail } from "@/lib/clerk-email";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Webhook Clerk → Supabase : garde la table `profiles` alignée sur Clerk.
 * Route publique (voir `proxy.ts`), mais chaque appel est authentifié par la
 * signature Svix (`CLERK_WEBHOOK_SIGNING_SECRET`) : sans elle, on refuse.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (error) {
    console.error("Webhook Clerk : signature invalide", error);
    return new Response("Signature invalide.", { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated":
        await syncProfile(evt.data);
        break;
      case "user.deleted":
        if (evt.data.id) await archiveProfile(evt.data.id);
        break;
    }
  } catch (error) {
    console.error(`Webhook Clerk (${evt.type}) :`, error);
    // 500 : Clerk renverra l'événement plus tard.
    return new Response("Synchronisation échouée.", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

/** Crée ou met à jour le profil. Sans rôle valide, on ne crée rien. */
async function syncProfile(user: UserJSON) {
  const { address: email, verified } = primaryEmail(user);
  // Adresse non vérifiée : n'importe qui peut saisir celle d'une recrue à
  // l'inscription et lui « prendre » sa fiche. On ne synchronise rien : Clerk
  // enverra `user.updated` quand l'adresse sera vérifiée (ce qui est déjà le
  // cas pour une invitation acceptée).
  if (!verified) return;

  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || email;
  const role = parseRole(user.public_metadata?.role);
  const supabase = createAdminSupabase();

  // Recrue invitée par les RH : on relie sa fiche (même e-mail, pas encore
  // de compte) au compte qu'elle vient d'activer. La fiche RH fait foi.
  if (email) {
    const { data: linked, error } = await supabase
      .from("profiles")
      .update({ clerk_user_id: user.id, status: "actif", invitation_id: null })
      .eq("email", email)
      .is("clerk_user_id", null)
      .eq("status", "invite")
      .select("id");
    if (error) throw new Error(error.message);
    if (linked.length > 0) {
      await writeAudit({
        actorId: null, // action du système (webhook)
        action: "account_activated",
        entity: "profiles",
        entityId: linked[0].id,
        details: { email },
      });
      return;
    }
  }

  if (!role) {
    // Compte encore sans rôle : le profil sera créé quand le Super-Admin
    // attribuera un rôle. S'il existe déjà, on rafraîchit l'e-mail.
    const { error } = await supabase
      .from("profiles")
      .update({ email })
      .eq("clerk_user_id", user.id);
    if (error) throw new Error(error.message);
    return;
  }

  // Fiche existante : e-mail et rôle suivent Clerk, le nom reste celui des RH.
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ email, role })
    .eq("clerk_user_id", user.id)
    .select("id");
  if (error) throw new Error(error.message);
  if (updated.length > 0) return;

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ clerk_user_id: user.id, email, full_name: fullName, role });
  if (insertError) throw new Error(insertError.message);
}

/** Compte supprimé dans Clerk : aucune suppression physique, on archive. */
async function archiveProfile(clerkUserId: string) {
  const supabase = createAdminSupabase();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "archive" })
    .eq("clerk_user_id", clerkUserId);
  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: null, // action du système (webhook)
    action: "account_archived",
    entity: "profiles",
    entityId: clerkUserId,
    details: { source: "clerk_webhook" },
  });
}
