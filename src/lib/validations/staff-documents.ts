import { z } from "zod";

import {
  ACCEPTED_TYPES,
  decisionNeedsReason,
  DOCUMENT_KINDS,
  MAX_DOCUMENT_BYTES,
  REVIEW_DECISIONS,
} from "@/lib/staff-documents";

/** Description du fichier choisi, contrôlée avant l'envoi. */
export const documentUploadSchema = z
  .object({
    profileId: z.uuid("Fiche invalide."),
    kind: z.enum(DOCUMENT_KINDS, { message: "Type de document invalide." }),
    fileName: z
      .string()
      .trim()
      .min(1, "Nom de fichier manquant.")
      .max(200, "Nom de fichier trop long."),
    mimeType: z.string(),
    size: z
      .number()
      .int()
      .min(1, "Le fichier est vide.")
      .max(MAX_DOCUMENT_BYTES, "Le fichier dépasse 5 Mo."),
  })
  .refine((value) => ACCEPTED_TYPES[value.kind].includes(value.mimeType), {
    message:
      "Format non accepté (PDF, JPEG, PNG ou WebP ; image pour la photo).",
    path: ["mimeType"],
  });

export type DocumentUpload = z.infer<typeof documentUploadSchema>;

/** Confirmation après l'envoi : le chemin fourni par le serveur en plus. */
export const documentConfirmSchema = documentUploadSchema.and(
  z.object({ storagePath: z.string().min(1) }),
);

export const documentIdSchema = z.object({
  documentId: z.uuid("Document invalide."),
});

/** Contrôle d'une pièce : validée, ou rejetée avec un motif. */
export const documentReviewSchema = z
  .object({
    documentId: z.uuid("Document invalide."),
    decision: z.enum(REVIEW_DECISIONS, { message: "Décision invalide." }),
    reason: z
      .string()
      .trim()
      .max(500, "Le motif ne doit pas dépasser 500 caractères."),
  })
  .refine(
    (value) => !decisionNeedsReason(value.decision) || value.reason.length >= 3,
    {
      message: "Le motif du rejet est obligatoire (3 caractères minimum).",
      path: ["reason"],
    },
  );

export type DocumentResult = { ok: boolean; message: string };

export type PrepareUploadResult =
  | { ok: true; storagePath: string; token: string }
  | { ok: false; message: string };

export type SignedUrlResult =
  { ok: true; url: string } | { ok: false; message: string };
