import { z } from "zod";

import { BILAN_KINDS, periodStartFrom } from "@/lib/bilans";

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
