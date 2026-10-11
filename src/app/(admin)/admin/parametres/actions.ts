"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth/action-guard";
import {
  ASSET_LABELS,
  buildAssetPath,
  detectImageType,
  IMAGE_MIME,
  isAssetKind,
  MAX_ASSET_BYTES,
  ORG_ASSETS_BUCKET,
} from "@/lib/org-assets";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  organizationSettingsSchema,
  type SettingsResult,
} from "@/lib/validations/settings";

export async function updateOrganizationSettings(
  input: unknown,
): Promise<SettingsResult> {
  const caller = await requireSuperAdmin();
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { organizationName, academicYear, currentSemester } = parsed.data;

  try {
    // Client avec le jeton de l'utilisateur : la RLS revérifie le rôle.
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("organization_settings")
      .update({
        organization_name: organizationName,
        academic_year: academicYear,
        current_semester: currentSemester,
        updated_by: caller.actorId,
      })
      .eq("id", true)
      .select("id");

    if (error) {
      console.error("organization_settings :", error.message);
      return {
        ok: false,
        message: "Enregistrement impossible. Réessayez dans un instant.",
      };
    }
    // Refus de la RLS : aucune erreur, mais aucune ligne modifiée.
    if (data.length === 0) {
      return {
        ok: false,
        message:
          "Modification refusée par la base : vérifiez la liaison Clerk ↔ Supabase.",
      };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "settings_updated",
      entity: "organization_settings",
      entityId: null,
      details: {
        organization_name: organizationName,
        academic_year: academicYear,
        current_semester: currentSemester,
      },
    });

    // Rafraîchit aussi l'en-tête (année, semestre) de tout l'espace admin.
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Paramètres enregistrés." };
  } catch (error) {
    console.error("updateOrganizationSettings :", error);
    return {
      ok: false,
      message: "Une erreur est survenue. Réessayez dans un instant.",
    };
  }
}

/**
 * Envoie le logo ou la signature. Le serveur lit le fichier REÇU et vérifie son
 * contenu (en-tête PNG ou JPEG) : le type annoncé par le navigateur ne prouve
 * rien. Chaque envoi crée un nouveau fichier (jamais d'écrasement) et change le
 * chemin mémorisé ; l'ancien fichier reste dans le stockage.
 */
export async function uploadOrganizationAsset(
  formData: FormData,
): Promise<SettingsResult> {
  const caller = await requireSuperAdmin();
  if (!caller.ok) return { ok: false, message: caller.message };

  const kind = formData.get("kind");
  const file = formData.get("file");
  if (!isAssetKind(kind))
    return { ok: false, message: "Type d'image invalide." };
  if (!(file instanceof File) || file.size < 1) {
    return { ok: false, message: "Choisissez une image." };
  }
  if (file.size > MAX_ASSET_BYTES) {
    return {
      ok: false,
      message: "L'image dépasse 500 Ko. Compressez-la puis recommencez.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return {
      ok: false,
      message: "Ce fichier n'est pas une image PNG ou JPEG valide.",
    };
  }

  try {
    // Jeton de l'utilisateur : la RLS du stockage et de la table revérifient le rôle.
    const supabase = await createServerSupabase();
    const path = buildAssetPath(kind, type, randomUUID());
    const { error: uploadError } = await supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .upload(path, bytes, { contentType: IMAGE_MIME[type], upsert: false });
    if (uploadError) {
      console.error("storage :", uploadError.message);
      return { ok: false, message: "L'envoi a échoué. Réessayez." };
    }

    const { data, error } = await supabase
      .from("organization_settings")
      .update(
        kind === "logo"
          ? { logo_path: path, updated_by: caller.actorId }
          : { signature_path: path, updated_by: caller.actorId },
      )
      .eq("id", true)
      .select("id");
    if (error) {
      console.error("organization_settings :", error.message);
      return { ok: false, message: "Enregistrement impossible. Réessayez." };
    }
    // Refus de la RLS : aucune erreur, mais aucune ligne modifiée.
    if (data.length === 0) {
      return {
        ok: false,
        message:
          "Modification refusée par la base : vérifiez la liaison Clerk ↔ Supabase.",
      };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "organization_asset_updated",
      entity: "organization_settings",
      entityId: null,
      details: { kind },
    });
    revalidatePath("/admin/parametres");
    return { ok: true, message: `${ASSET_LABELS[kind]} enregistré.` };
  } catch (error) {
    console.error("uploadOrganizationAsset :", error);
    return {
      ok: false,
      message: "Une erreur est survenue. Réessayez dans un instant.",
    };
  }
}
