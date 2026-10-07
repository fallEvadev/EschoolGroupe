"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { resolveAppUrl } from "@/lib/app-url";
import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { formatMonthLabel } from "@/lib/dates";
import {
  buildProgramPath,
  isValidProgramPath,
  looksLikePdf,
  MAX_PROGRAM_BYTES,
  PROGRAM_MIME_TYPE,
  PROGRAMS_BUCKET,
  programMonthToDate,
} from "@/lib/programs";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  programConfirmSchema,
  programUploadSchema,
  type PrepareProgramResult,
  type PublishProgramResult,
} from "@/lib/validations/programs";
import { buildWhatsAppUrl, programMessage } from "@/lib/whatsapp";

import { PEDAGOGY_ROLES } from "../ecoles/access";

const ERREUR_GENERIQUE = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
} as const;

/** Adresse de la page « Documents » des formateurs (lien de l'annonce WhatsApp). */
async function documentsUrl(): Promise<string> {
  const list = await headers();
  const origin = resolveAppUrl({
    configured: process.env.NEXT_PUBLIC_APP_URL,
    host: list.get("x-forwarded-host") ?? list.get("host"),
    forwardedProto: list.get("x-forwarded-proto"),
  });
  return `${origin}/formateur/documents`;
}

/**
 * Étape 1 : vérifie les droits et le fichier annoncé, puis donne une
 * autorisation d'envoi à usage unique. Le navigateur envoie ensuite le PDF
 * directement au stockage (plus fiable sur une connexion lente).
 */
export async function prepareProgramUpload(
  input: unknown,
): Promise<PrepareProgramResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = programUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Fichier invalide.",
    };
  }
  const { month, fileName } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const storagePath = buildProgramPath(month, fileName, randomUUID());
    // La RLS du stockage revérifie le rôle avant de donner l'autorisation.
    const { data, error } = await supabase.storage
      .from(PROGRAMS_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error) {
      console.error("storage :", error.message);
      return ERREUR_GENERIQUE;
    }
    return { ok: true, storagePath: data.path, token: data.token };
  } catch (error) {
    console.error("prepareProgramUpload :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Étape 2 : après l'envoi, vérifie le fichier REÇU (type et taille relevés dans
 * le stockage, puis l'en-tête « %PDF- » : le type annoncé par le navigateur ne
 * prouve rien), puis le publie. Le programme du même mois passe en « remplacé »
 * dans la même transaction (aucune suppression).
 */
export async function confirmProgramUpload(
  input: unknown,
): Promise<PublishProgramResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = programConfirmSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Fichier invalide.",
    };
  }
  const { month, title, fileName, size, storagePath } = parsed.data;

  if (!isValidProgramPath(storagePath, month)) {
    return { ok: false, message: "Envoi invalide. Recommencez." };
  }

  try {
    const supabase = await createServerSupabase();
    const bucket = supabase.storage.from(PROGRAMS_BUCKET);

    // Type et taille réels du fichier arrivé dans le stockage.
    const { data: info } = await bucket.info(storagePath);
    let storedSize = size;
    if (info) {
      storedSize = info.size ?? size;
      if (info.contentType && info.contentType !== PROGRAM_MIME_TYPE) {
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
    if (storedSize < 1 || storedSize > MAX_PROGRAM_BYTES) {
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

    const { error } = await supabase.rpc("replace_monthly_program", {
      p_month: programMonthToDate(month),
      p_title: title,
      p_storage_path: storagePath,
      p_file_name: fileName,
      p_size_bytes: storedSize,
    });
    if (error) {
      console.error("replace_monthly_program :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "program_published",
      entity: "monthly_programs",
      entityId: null,
      details: { month, title, file_name: fileName },
    });
    revalidatePath("/admin/programmes");
    // Le formateur voit le programme sur son accueil et dans « Documents ».
    revalidatePath("/formateur", "layout");

    const monthLabel = formatMonthLabel(month);
    return {
      ok: true,
      message: `Programme de ${monthLabel} publié.`,
      whatsappUrl: buildWhatsAppUrl(
        null,
        programMessage({ monthLabel, url: await documentsUrl() }),
      ),
    };
  } catch (error) {
    console.error("confirmProgramUpload :", error);
    return ERREUR_GENERIQUE;
  }
}
