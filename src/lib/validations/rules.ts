import { z } from "zod";

/** Publication d'une nouvelle version du règlement (mêmes bornes que la table SQL). */
export const publishRulesSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caractères.")
    .max(150, "Le titre ne doit pas dépasser 150 caractères."),
  content: z
    .string()
    .trim()
    .min(20, "Le texte du règlement est trop court (20 caractères minimum).")
    .max(50000, "Le texte ne doit pas dépasser 50 000 caractères."),
});

export type PublishRulesInput = z.infer<typeof publishRulesSchema>;

/** Acceptation de la version affichée : la case doit être cochée. */
export const acceptRulesSchema = z.object({
  rulesId: z.uuid("Version invalide."),
  accepted: z.literal(true, {
    message: "Cochez la case pour accepter le règlement.",
  }),
});

export type RulesResult = { ok: boolean; message: string };
