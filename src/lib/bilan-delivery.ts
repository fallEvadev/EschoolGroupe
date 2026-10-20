import "server-only";

import { Resend } from "resend";

import { bilanTitle, isBilanKind, periodLabel } from "@/lib/bilans";
import {
  buildBilanEmail,
  sanitizeProviderError,
  type DeliverySummary,
} from "@/lib/emails/bilan-published";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** Clé et adresse d'expédition de Resend, ou `null` si l'e-mail n'est pas configuré. */
export function emailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

/**
 * Envoie l'e-mail « un bilan est disponible » aux directeurs ACTIFS de l'école,
 * et enregistre le résultat de chaque envoi dans `bilan_deliveries`.
 *
 * Client administrateur (clé de service) : il lit les adresses e-mail, que la
 * Direction ne peut pas lire, et il est le seul à écrire le suivi. **L'appelant
 * doit avoir vérifié les droits de la Direction pédagogique avant.** Les adresses
 * ne sont ni renvoyées, ni écrites dans le suivi, ni dans les journaux.
 *
 * - `onlyPending` : ne relance que les directeurs qui n'ont pas déjà reçu
 *   l'e-mail (renvoi après un échec).
 * - L'envoi ne lève jamais d'exception pour un destinataire : un échec est
 *   enregistré et comptabilisé.
 */
export async function sendBilanEmails({
  bilanId,
  origin,
  onlyPending,
}: {
  bilanId: string;
  /** Adresse publique du site, sans barre finale. */
  origin: string;
  onlyPending: boolean;
}): Promise<DeliverySummary | { error: string }> {
  const config = emailConfig();
  if (!config) return { configured: false, sent: 0, failed: 0 };

  const supabase = createAdminSupabase();

  const { data: bilan, error: bilanError } = await supabase
    .from("bilans")
    .select("school_id, period_kind, period_start, status")
    .eq("id", bilanId)
    .maybeSingle();
  if (bilanError) {
    console.error("bilans :", bilanError.message);
    return { error: "Le bilan n'a pas pu être lu." };
  }
  if (!bilan) return { error: "Bilan introuvable." };
  if (bilan.status !== "publie") {
    return { error: "Seul un bilan publié est envoyé aux directeurs." };
  }
  if (!isBilanKind(bilan.period_kind)) {
    return { error: "Type de période inconnu pour ce bilan." };
  }

  const [schoolResult, settingsResult, linksResult, deliveriesResult] =
    await Promise.all([
      supabase
        .from("schools")
        .select("name")
        .eq("id", bilan.school_id)
        .maybeSingle(),
      supabase
        .from("organization_settings")
        .select("organization_name")
        .maybeSingle(),
      supabase
        .from("school_directors")
        .select("profile_id")
        .eq("school_id", bilan.school_id)
        .eq("status", "actif"),
      supabase
        .from("bilan_deliveries")
        .select("profile_id, status, attempts")
        .eq("bilan_id", bilanId),
    ]);
  for (const [name, error] of [
    ["schools", schoolResult.error],
    ["organization_settings", settingsResult.error],
    ["school_directors", linksResult.error],
    ["bilan_deliveries", deliveriesResult.error],
  ] as const) {
    if (error) {
      console.error(`${name} :`, error.message);
      return { error: "Les destinataires n'ont pas pu être lus." };
    }
  }

  const profileIds = (linksResult.data ?? []).map((link) => link.profile_id);
  const recipients = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", profileIds)
        .eq("status", "actif")
    : { data: [], error: null };
  if (recipients.error) {
    console.error("profiles :", recipients.error.message);
    return { error: "Les destinataires n'ont pas pu être lus." };
  }

  const previous = new Map(
    (deliveriesResult.data ?? []).map((row) => [row.profile_id, row]),
  );
  const resend = new Resend(config.apiKey);
  const common = {
    schoolName: schoolResult.data?.name ?? "votre école",
    title: bilanTitle(bilan.period_kind),
    periodLabel: periodLabel(bilan.period_kind, bilan.period_start),
    portalUrl: `${origin}/partenaire/bilans`,
    organizationName:
      settingsResult.data?.organization_name ?? "E-School",
  };

  let sent = 0;
  let failed = 0;
  for (const person of recipients.data ?? []) {
    const before = previous.get(person.id);
    if (onlyPending && before?.status === "envoye") continue;

    const email = buildBilanEmail({
      ...common,
      recipientName: person.full_name,
    });
    let messageId: string | null = null;
    let failure: string | null = null;
    try {
      const { data, error } = await resend.emails.send({
        from: config.from,
        to: [person.email],
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (error) failure = sanitizeProviderError(error.message);
      else messageId = data?.id ?? null;
    } catch (error) {
      failure = sanitizeProviderError(
        error instanceof Error ? error.message : null,
      );
    }

    const { error: saveError } = await supabase.from("bilan_deliveries").upsert(
      {
        bilan_id: bilanId,
        profile_id: person.id,
        status: failure ? "echec" : "envoye",
        attempts: (before?.attempts ?? 0) + 1,
        sent_at: failure ? null : new Date().toISOString(),
        last_error: failure,
        provider_message_id: messageId,
      },
      { onConflict: "bilan_id,profile_id" },
    );
    if (saveError) console.error("bilan_deliveries :", saveError.message);

    if (failure) {
      failed += 1;
      console.error("e-mail de bilan :", failure);
    } else {
      sent += 1;
    }
  }

  return { configured: true, sent, failed };
}
