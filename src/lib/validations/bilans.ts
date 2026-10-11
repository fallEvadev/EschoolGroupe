import { z } from "zod";

import { BILAN_KINDS, periodStartFrom } from "@/lib/bilans";
import { BILAN_PDF_MIME, MAX_BILAN_PDF_BYTES } from "@/lib/bilan-pdf";

/**
 * Demande de génération : le type de période et la saisie (un jour pour une
 * semaine, « aaaa-mm » pour un mois). Le début de période est calculé ici, pas
 * par le navigateur.
 */
export const generateBilansSchema = z
  .object({
    kind: z.enum(BILAN_KINDS, { message: "Type de période invalide." }),
    value: z.string().trim(),
  })
  .transform((input, ctx) => {
    const periodStart = periodStartFrom(input.kind, input.value);
    if (!periodStart) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          input.kind === "semaine"
            ? "Choisissez un jour de la semaine."
            : "Choisissez un mois.",
      });
      return z.NEVER;
    }
    return { kind: input.kind, periodStart };
  });

export type GenerateBilansInput = z.input<typeof generateBilansSchema>;

export type BilanResult = { ok: boolean; message: string };

export const bilanIdSchema = z.object({
  bilanId: z.uuid("Bilan invalide."),
});

/** Description du PDF choisi, contrôlée avant l'envoi. */
export const bilanPdfUploadSchema = z.object({
  bilanId: z.uuid("Bilan invalide."),
  fileName: z
    .string()
    .trim()
    .min(1, "Nom de fichier manquant.")
    .max(200, "Nom de fichier trop long."),
  mimeType: z.literal(BILAN_PDF_MIME, {
    message: "Seul un fichier PDF est accepté.",
  }),
  size: z
    .number()
    .int()
    .min(1, "Le fichier est vide.")
    .max(MAX_BILAN_PDF_BYTES, "Le fichier dépasse 10 Mo."),
});

/** Confirmation après l'envoi : le chemin fourni par le serveur en plus. */
export const bilanPdfConfirmSchema = bilanPdfUploadSchema.and(
  z.object({ storagePath: z.string().min(1) }),
);

export type PrepareBilanPdfResult =
  | { ok: true; storagePath: string; token: string }
  | { ok: false; message: string };
