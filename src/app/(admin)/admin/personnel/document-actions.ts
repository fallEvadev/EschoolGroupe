"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import {
  buildStoragePath,
  DOCUMENT_LABELS,
  STAFF_DOCUMENTS_BUCKET,
} from "@/lib/staff-documents";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  documentConfirmSchema,
  documentIdSchema,
  documentUploadSchema,
  type DocumentResult,
  type PrepareUploadResult,
  type SignedUrlResult,
} from "@/lib/validations/staff-documents";

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    if (!profile) return { ok: false, message: "Fiche introuvable." };

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

  // Le chemin doit être celui préparé pour cette fiche et ce type.
  if (!storagePath.startsWith(`${profileId}/${kind}/`)) {
    return { ok: false, message: "Envoi invalide. Recommencez." };
  }

  try {
    const supabase = await createServerSupabase();
    const { data: exists } = await supabase.storage
      .from(STAFF_DOCUMENTS_BUCKET)
      .exists(storagePath);
    if (!exists) {
      return {
        ok: false,
        message:
          "Le fichier n'est pas arrivé. Vérifiez la connexion et recommencez.",
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
        mime_type: mimeType,
        size_bytes: size,
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
