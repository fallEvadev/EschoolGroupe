import { z } from "zod";

/** Paramètres de l'organisation (mêmes règles que la table SQL). */
export const organizationSettingsSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom ne doit pas dépasser 120 caractères."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Format attendu : 2025-2026.")
    .refine((value) => {
      const [start, end] = value.split("-").map(Number);
      return end === start + 1;
    }, "La seconde année doit suivre la première (ex. 2025-2026)."),
  currentSemester: z
    .number({ message: "Semestre invalide." })
    .refine((value) => [1, 2].includes(value), "Semestre invalide."),
});

export type OrganizationSettingsInput = z.infer<
  typeof organizationSettingsSchema
>;

export type SettingsResult = { ok: boolean; message: string };
