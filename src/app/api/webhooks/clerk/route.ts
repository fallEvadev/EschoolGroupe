import type { UserJSON } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { parseRole } from "@/lib/auth/roles";
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
  const email =
    user.email_addresses.find((e) => e.id === user.primary_email_address_id)
      ?.email_address ?? "";
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || email;
  const role = parseRole(user.public_metadata?.role);
  const supabase = createAdminSupabase();

  if (!role) {
    // Compte encore sans rôle : le profil sera créé quand le Super-Admin
    // attribuera un rôle. S'il existe déjà, on rafraîchit nom et email.
    const { error } = await supabase
      .from("profiles")
      .update({ email, full_name: fullName })
      .eq("clerk_user_id", user.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { clerk_user_id: user.id, email, full_name: fullName, role },
      { onConflict: "clerk_user_id" },
    );
  if (error) throw new Error(error.message);
}

/** Compte supprimé dans Clerk : aucune suppression physique, on archive. */
async function archiveProfile(clerkUserId: string) {
  const supabase = createAdminSupabase();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "archive" })
    .eq("clerk_user_id", clerkUserId);
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from("audit_log").insert({
    actor_clerk_id: null, // action du système (webhook)
    action: "account_archived",
    entity: "profiles",
    entity_id: clerkUserId,
    details: { source: "clerk_webhook" },
  });
  if (auditError) console.error("audit_log :", auditError.message);
}
