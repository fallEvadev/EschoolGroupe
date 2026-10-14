"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { resolveAppUrl } from "@/lib/app-url";
import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import {
  BILAN_PDF_MIME,
  BILANS_BUCKET,
  buildBilanPdfPath,
  isValidBilanPdfPath,
  MAX_BILAN_PDF_BYTES,
} from "@/lib/bilan-pdf";
import { sendBilanEmails } from "@/lib/bilan-delivery";
import { summarizeGeneration } from "@/lib/bilans";
import { summarizeDeliveries } from "@/lib/emails/bilan-published";
import { looksLikePdf } from "@/lib/programs";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  bilanIdSchema,
  bilanPdfConfirmSchema,
  bilanPdfUploadSchema,
  generateBilansSchema,
  type BilanResult,
  type PrepareBilanPdfResult,
} from "@/lib/validations/bilans";

import { PEDAGOGY_ROLES } from "../ecoles/access";

/** Codes PostgreSQL renvoyés par les fonctions de bilan. */
const NOT_FOUND = "P0002";
const NOT_ALLOWED = "42501";
const CHECK_VIOLATION = "23514";

const ERREUR_GENERIQUE = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
} as const;

/**
 * Traduit une erreur d'une fonction SQL de bilan. Leurs messages sont écrits en
 * français dans la base et ne contiennent aucune donnée sensible.
 */
function mapError(error: { code?: string; message: string }): BilanResult {
  if (
    error.code === NOT_FOUND ||
    error.code === NOT_ALLOWED ||
    error.code === CHECK_VIOLATION
  ) {
    return { ok: false, message: error.message };
  }
  console.error("bilans :", error.message);
  return ERREUR_GENERIQUE;
}

/**
 * Le bouton « Générer » : crée ou actualise un bilan pour chaque école qui a des
 * rapports validés sur la période. Tout se passe dans la fonction SQL
 * `generate_bilans` (une seule transaction, avec le jeton de l'utilisateur : la
 * RLS et les garde-fous de la base s'appliquent). Un bilan déjà publié n'est
 * jamais touché ; le PDF d'un brouillon qui reçoit de nouveaux rapports est
 * détaché.
 */
export async function generateBilans(input: unknown): Promise<BilanResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = generateBilansSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Période invalide.",
    };
  }
  const { kind, periodStart } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("generate_bilans", {
      p_kind: kind,
      p_start: periodStart,
    });
    if (error) return mapError(error);

    const outcomes = data.map((row) => ({
      outcome: row.out_outcome,
      pdfReset: row.out_pdf_reset,
    }));
    await writeAudit({
      actorId: caller.actorId,
      action: "bilans_generated",
      entity: "bilans",
      entityId: null,
      details: {
        kind,
        period_start: periodStart,
        bilans: outcomes.length,
      },
    });
    revalidatePath("/admin/bilans");
    return { ok: true, message: summarizeGeneration(outcomes) };
  } catch (error) {
    console.error("generateBilans :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Étape 1 du dépôt du PDF final : vérifie les droits et le fichier annoncé, puis
 * donne une autorisation d'envoi à usage unique. Le navigateur envoie ensuite le
 * PDF directement au stockage (plus fiable sur une connexion lente).
 */
export async function prepareBilanPdfUpload(
  input: unknown,
): Promise<PrepareBilanPdfResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = bilanPdfUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Fichier invalide.",
    };
  }
  const { bilanId, fileName } = parsed.data;

  try {
    const supabase = await createServerSupabase();

    // Le bilan doit exister et être encore un brouillon (RLS : Direction seulement).
    const { data: bilan, error: bilanError } = await supabase
      .from("bilans")
      .select("status")
      .eq("id", bilanId)
      .maybeSingle();
    if (bilanError) {
      console.error("bilans :", bilanError.message);
      return ERREUR_GENERIQUE;
    }
    if (!bilan) return { ok: false, message: "Bilan introuvable." };
    if (bilan.status !== "brouillon") {
      return { ok: false, message: "Un bilan publié est figé." };
    }

    const storagePath = buildBilanPdfPath(bilanId, fileName, randomUUID());
    // La RLS du stockage revérifie le rôle avant de donner l'autorisation.
    const { data, error } = await supabase.storage
      .from(BILANS_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error) {
      console.error("storage :", error.message);
      return ERREUR_GENERIQUE;
    }
    return { ok: true, storagePath: data.path, token: data.token };
  } catch (error) {
    console.error("prepareBilanPdfUpload :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Étape 2 : après l'envoi, vérifie le fichier REÇU (type et taille relevés dans
 * le stockage, puis l'en-tête « %PDF- » : le type annoncé par le navigateur ne
 * prouve rien), puis le rattache au bilan. Le PDF précédent d'un brouillon est
 * remplacé (il reste dans le stockage).
 */
export async function confirmBilanPdfUpload(
  input: unknown,
): Promise<BilanResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = bilanPdfConfirmSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Fichier invalide.",
    };
  }
  const { bilanId, fileName, size, storagePath } = parsed.data;

  if (!isValidBilanPdfPath(bilanId, storagePath)) {
    return { ok: false, message: "Envoi invalide. Recommencez." };
  }

  try {
    const supabase = await createServerSupabase();
    const bucket = supabase.storage.from(BILANS_BUCKET);

    // Type et taille réels du fichier arrivé dans le stockage.
    const { data: info } = await bucket.info(storagePath);
    let storedSize = size;
    if (info) {
      storedSize = info.size ?? size;
      if (info.contentType && info.contentType !== BILAN_PDF_MIME) {
        return { ok: false, message: "Seul un fichier PDF est accepté." };
      }
    } else {
      const { data: exists } = await bucket.exists(storagePath);
      if (!exists) {
        return {
          ok: false,
          message:
            "Le fichier n'est pas arrivé. Vérifiez la connexion et recommencez.",
        };
      }
    }
    if (storedSize < 1 || storedSize > MAX_BILAN_PDF_BYTES) {
      return { ok: false, message: "Le fichier dépasse 10 Mo." };
    }

    // Les 5 premiers octets suffisent : un vrai PDF commence par « %PDF- ».
    const { data: signed, error: signedError } = await bucket.createSignedUrl(
      storagePath,
      30,
    );
    if (signedError) {
      console.error("storage :", signedError.message);
      return ERREUR_GENERIQUE;
    }
    const head = await fetch(signed.signedUrl, {
      headers: { Range: "bytes=0-4" },
      cache: "no-store",
    });
    if (!head.ok) {
      return {
        ok: false,
        message: "Le fichier n'a pas pu être vérifié. Recommencez.",
      };
    }
    const bytes = new Uint8Array(await head.arrayBuffer()).slice(0, 5);
    if (!looksLikePdf(bytes)) {
      return {
        ok: false,
        message:
          "Ce fichier n'est pas un vrai PDF. Choisissez un autre fichier.",
      };
    }

    const { error } = await supabase.rpc("attach_bilan_pdf", {
      p_bilan_id: bilanId,
      p_path: storagePath,
      p_file_name: fileName,
      p_size: storedSize,
    });
    if (error) return mapError(error);

    await writeAudit({
      actorId: caller.actorId,
      action: "bilan_pdf_attached",
      entity: "bilans",
      entityId: bilanId,
      details: { size_bytes: storedSize },
    });
    revalidatePath("/admin/bilans");
    return { ok: true, message: "PDF final enregistré." };
  } catch (error) {
    console.error("confirmBilanPdfUpload :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Publie un bilan : il doit être en brouillon et avoir son PDF final. Une fois
 * publié, il est figé (la base refuse toute modification).
 */
export async function publishBilan(input: unknown): Promise<BilanResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = bilanIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Bilan invalide.",
    };
  }
  const { bilanId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.rpc("publish_bilan", {
      p_bilan_id: bilanId,
    });
    if (error) return mapError(error);

    await writeAudit({
      actorId: caller.actorId,
      action: "bilan_published",
      entity: "bilans",
      entityId: bilanId,
      details: {},
    });
    revalidatePath("/admin/bilans");

    // L'e-mail ne bloque jamais la publication : le bilan est publié quoi qu'il
    // arrive, et les directeurs sont aussi prévenus dans l'application.
    const emails = await deliverEmails(caller.actorId, bilanId, false);
    return { ok: true, message: `Bilan publié. ${emails}` };
  } catch (error) {
    console.error("publishBilan :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Adresse publique du site (variable d'environnement, sinon en-têtes de la requête). */
async function siteOrigin(): Promise<string> {
  const list = await headers();
  return resolveAppUrl({
    configured: process.env.NEXT_PUBLIC_APP_URL,
    host: list.get("x-forwarded-host") ?? list.get("host"),
    forwardedProto: list.get("x-forwarded-proto"),
  });
}

/**
 * Envoie les e-mails d'un bilan publié et renvoie la phrase de résultat. Ne lève
 * jamais d'exception : un problème d'envoi devient un message, pas une erreur.
 * L'audit ne garde que des nombres, jamais d'adresse.
 */
async function deliverEmails(
  actorId: string,
  bilanId: string,
  onlyPending: boolean,
): Promise<string> {
  try {
    const result = await sendBilanEmails({
      bilanId,
      origin: await siteOrigin(),
      onlyPending,
    });
    if ("error" in result) return result.error;

    if (result.configured) {
      await writeAudit({
        actorId,
        action: "bilan_emails_sent",
        entity: "bilans",
        entityId: bilanId,
        details: { sent: result.sent, failed: result.failed },
      });
    }
    revalidatePath("/admin/bilans");
    return summarizeDeliveries(result);
  } catch (error) {
    console.error("deliverEmails :", error);
    return "L'envoi des e-mails a échoué : les directeurs sont prévenus dans l'application.";
  }
}

/**
 * Renvoie l'e-mail aux directeurs d'un bilan publié qui ne l'ont pas encore reçu
 * (échecs, ou directeur rattaché depuis). Ceux qui l'ont reçu ne sont pas relancés.
 */
export async function resendBilanEmails(input: unknown): Promise<BilanResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = bilanIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Bilan invalide.",
    };
  }
  const message = await deliverEmails(
    caller.actorId,
    parsed.data.bilanId,
    true,
  );
  return { ok: true, message };
}
