import { z } from "zod";

import { fullNameSchema, phoneSchema } from "@/lib/validations/staff";

/** Nombre maximum d'adjoints par école (le même chiffre est dans la base). */
export const MAX_DEPUTIES_PER_SCHOOL = 2;

/** Invitation d'un adjoint par le directeur de l'école. */
export const deputyInviteSchema = z.object({
  schoolId: z.uuid("École invalide."),
  fullName: fullNameSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Adresse e-mail invalide.")),
  phone: phoneSchema,
});

export type DeputyInviteFormValues = z.input<typeof deputyInviteSchema>;
export type DeputyInviteData = z.output<typeof deputyInviteSchema>;

/** Retrait d'un adjoint. */
export const deputyRemoveSchema = z.object({
  schoolId: z.uuid("École invalide."),
  profileId: z.uuid("Personne invalide."),
});
