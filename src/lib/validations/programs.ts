import { z } from "zod";

import { isIsoMonth } from "@/lib/dates";
import { MAX_PROGRAM_BYTES, PROGRAM_MIME_TYPE } from "@/lib/programs";

/** Description du fichier choisi, contrôlée avant l'envoi. */
export const programUploadSchema = z.object({
  month: z.string().refine(isIsoMonth, "Mois invalide."),
  title: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caractères.")
    .max(150, "Le titre ne doit pas dépasser 150 caractères."),
  fileName: z
    .string()
    .trim()
    .min(1, "Nom de fichier manquant.")
    .max(200, "Nom de fichier trop long."),
  mimeType: z.literal(PROGRAM_MIME_TYPE, {
    message: "Seul un fichier PDF est accepté.",
  }),
  size: z
    .number()
    .int()
    .min(1, "Le fichier est vide.")
    .max(MAX_PROGRAM_BYTES, "Le fichier dépasse 10 Mo."),
});

export type ProgramUpload = z.infer<typeof programUploadSchema>;

/** Confirmation après l'envoi : le chemin fourni par le serveur en plus. */
export const programConfirmSchema = programUploadSchema.and(
  z.object({ storagePath: z.string().min(1) }),
);

export const programIdSchema = z.object({
  programId: z.uuid("Programme invalide."),
});

export type PrepareProgramResult =
  | { ok: true; storagePath: string; token: string }
  | { ok: false; message: string };

export type PublishProgramResult =
  | {
      ok: true;
      message: string;
      /** Lien WhatsApp avec l'annonce déjà écrite (choix du groupe dans WhatsApp). */
      whatsappUrl: string;
    }
  | { ok: false; message: string };

export type ProgramUrlResult =
  { ok: true; url: string } | { ok: false; message: string };
