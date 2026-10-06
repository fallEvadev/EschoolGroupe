"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import {
  buildStoragePath,
  decisionNeedsReason,
  DOCUMENT_LABELS,
  isAcceptedFile,
  isDocumentKind,
  isValidStoragePath,
  STAFF_DOCUMENTS_BUCKET,
} from "@/lib/staff-documents";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  documentConfirmSchema,
  documentIdSchema,
  documentReviewSchema,
  documentUploadSchema,
  type DocumentResult,
  type PrepareUploadResult,
  type SignedUrlResult,
} from "@/lib/validations/staff-documents";

import { ADMIN_PROFILE_MESSAGE, checkProfileAccess } from "./access";

const RH_ROLES = ["admin_rh", "super_admin"] as const;

/** Durée de validité d'un lien de consultation (règle : courte durée). */
const SIGNED_URL_SECONDS = 60;

const ERREUR_GENERIQUE = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
} as const;

/**
 * Étape 1 : vérifie les droits et le fichier, puis donne une autorisation
 * d'envoi à usage unique. Le navigateur envoie ensuite le fichier directement
 * au stockage (plus fiable sur une connexion lente).
 */
export async function prepareDocumentUpload(
  input: unknown,
): Promise<PrepareUploadResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = documentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Fichier invalide.",
    };
  }
  const { profileId, kind, fileName } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const access = await checkProfileAccess(supabase, caller.role, profileId);
    if (access === "not_found") {
      return { ok: false, message: "Fiche introuvable." };
    }
    if (access === "forbidden") {
      return { ok: false, message: ADMIN_PROFILE_MESSAGE };
    }

    const storagePath = buildStoragePath(
      profileId,
      kind,
      fileName,
      randomUUID(),
    );
    // La RLS du stockage revérifie le rôle avant de donner l'autorisation.
    const { data, error } = await supabase.storage
      .from(STAFF_DOCUMENTS_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error) {
      console.error("storage :", error.message);
      return ERREUR_GENERIQUE;
    }
    return { ok: true, storagePath: data.path, token: data.token };
  } catch (error) {
    console.error("prepareDocumentUpload :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Étape 2 : après l'envoi, vérifie que le fichier est bien arrivé à l'endroit
 * prévu, puis l'inscrit au dossier. L'ancienne version du même type passe en
 * « remplace » (aucune suppression).
 */
export async function confirmDocumentUpload(
  input: unknown,
): Promise<DocumentResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = documentConfirmSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Fichier invalide.",
    };
  }
  const { profileId, kind, fileName, mimeType, size, storagePath } =
    parsed.data;

  // Le chemin doit avoir exactement la forme préparée pour cette fiche et ce type.
  if (!isValidStoragePath(storagePath, profileId, kind)) {
    return { ok: false, message: "Envoi invalide. Recommencez." };
  }

  try {
    const supabase = await createServerSupabase();
    const access = await checkProfileAccess(supabase, caller.role, profileId);
    if (access === "not_found") {
      return { ok: false, message: "Fiche introuvable." };
    }
    if (access === "forbidden") {
      return { ok: false, message: ADMIN_PROFILE_MESSAGE };
    }

    // Type et taille réels du fichier arrivé dans le stockage : ce que
    // déclare le navigateur n'est pas une preuve. Si le stockage ne sait pas
    // les donner, on vérifie au moins que le fichier existe.
    const bucket = supabase.storage.from(STAFF_DOCUMENTS_BUCKET);
    const { data: info } = await bucket.info(storagePath);
    let storedMime = mimeType;
    let storedSize = size;
    if (info) {
      storedMime = info.contentType ?? mimeType;
      storedSize = info.size ?? size;
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
    if (!isAcceptedFile(kind, storedMime, storedSize)) {
      return {
        ok: false,
        message:
          "Le fichier reçu n'a pas un format ou une taille acceptés (PDF, JPEG, PNG ou WebP, 5 Mo maximum).",
      };
    }

    const { error: replaceError } = await supabase
      .from("staff_documents")
      .update({ status: "remplace" })
      .eq("profile_id", profileId)
      .eq("kind", kind)
      .eq("status", "actif");
    if (replaceError) {
      console.error("staff_documents :", replaceError.message);
      return ERREUR_GENERIQUE;
    }

    const { data: created, error } = await supabase
      .from("staff_documents")
      .insert({
        profile_id: profileId,
        kind,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: storedMime,
        size_bytes: storedSize,
        uploaded_by: caller.actorId,
      })
      .select("id")
      .single();
    if (error) {
      console.error("staff_documents :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "document_uploaded",
      entity: "profiles",
      entityId: profileId,
      details: { kind, document_id: created.id, file_name: fileName },
    });

    revalidatePath("/admin/personnel");
    return { ok: true, message: `${DOCUMENT_LABELS[kind]} enregistré.` };
  } catch (error) {
    console.error("confirmDocumentUpload :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Contrôle une pièce du dossier : validée, ou rejetée avec un motif. Seule la
 * version en vigueur peut être contrôlée ; un nouvel envoi repart « à vérifier ».
 */
export async function reviewDocument(input: unknown): Promise<DocumentResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = documentReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { documentId, decision } = parsed.data;
  const reason = decisionNeedsReason(decision) ? parsed.data.reason : null;

  try {
    const supabase = await createServerSupabase();
    const { data: document } = await supabase
      .from("staff_documents")
      .select("profile_id, kind, file_name, status")
      .eq("id", documentId)
      .maybeSingle();
    if (!document) return { ok: false, message: "Document introuvable." };
    const access = await checkProfileAccess(
      supabase,
      caller.role,
      document.profile_id,
    );
    if (access !== "ok") return { ok: false, message: ADMIN_PROFILE_MESSAGE };
    if (document.status !== "actif") {
      return {
        ok: false,
        message:
          "Cette pièce a été remplacée : contrôlez la version en vigueur.",
      };
    }

    // La condition sur `status` évite de contrôler une pièce remplacée entre-temps.
    const { data: updated, error } = await supabase
      .from("staff_documents")
      .update({
        review_status: decision,
        review_reason: reason,
        reviewed_by: caller.actorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("status", "actif")
      .select("id");
    if (error) {
      console.error("staff_documents :", error.message);
      return ERREUR_GENERIQUE;
    }
    if (updated.length === 0) {
      return {
        ok: false,
        message:
          "Contrôle impossible : la pièce vient de changer ou vos droits ne le permettent pas. Actualisez la page.",
      };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "document_reviewed",
      entity: "profiles",
      entityId: document.profile_id,
      details: {
        kind: document.kind,
        document_id: documentId,
        file_name: document.file_name,
        decision,
        reason,
      },
    });

    revalidatePath("/admin/personnel");
    const label = isDocumentKind(document.kind)
      ? DOCUMENT_LABELS[document.kind]
      : "Document";
    return {
      ok: true,
      message:
        decision === "valide" ? `${label} validé.` : `${label} rejeté.`,
    };
  } catch (error) {
    console.error("reviewDocument :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Lien de consultation valable 60 secondes. Chaque consultation est tracée. */
export async function getDocumentUrl(input: unknown): Promise<SignedUrlResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Document invalide." };

  try {
    const supabase = await createServerSupabase();
    const { data: document } = await supabase
      .from("staff_documents")
      .select("profile_id, kind, storage_path, file_name")
      .eq("id", parsed.data.documentId)
      .maybeSingle();
    if (!document) return { ok: false, message: "Document introuvable." };
    const access = await checkProfileAccess(
      supabase,
      caller.role,
      document.profile_id,
    );
    if (access !== "ok") return { ok: false, message: ADMIN_PROFILE_MESSAGE };

    const { data, error } = await supabase.storage
      .from(STAFF_DOCUMENTS_BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS);
    if (error) {
      console.error("storage :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "document_viewed",
      entity: "profiles",
      entityId: document.profile_id,
      details: {
        kind: document.kind,
        document_id: parsed.data.documentId,
        file_name: document.file_name,
      },
    });

    return { ok: true, url: data.signedUrl };
  } catch (error) {
    console.error("getDocumentUrl :", error);
    return ERREUR_GENERIQUE;
  }
}
