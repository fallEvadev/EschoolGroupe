import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";
import { CONTRACT_TYPES } from "@/lib/staff";

/** Champ facultatif : une chaîne vide devient `null`. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

/**
 * Téléphone sénégalais : 9 chiffres commençant par 7 ou 3, avec ou sans
 * indicatif +221 / 00221. Espaces, points et tirets acceptés.
 */
const PHONE_PATTERN = /^(?:\+221|00221)?[37]\d{8}$/;

/** Fiche d'un membre du personnel (création et modification). */
export const staffSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Le prénom est obligatoire.")
    .max(60, "Le prénom ne doit pas dépasser 60 caractères."),
  lastName: z
    .string()
    .trim()
    .min(1, "Le nom est obligatoire.")
    .max(60, "Le nom ne doit pas dépasser 60 caractères."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Adresse e-mail invalide.")),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s.-]/g, ""))
    .refine(
      (value) => value === "" || PHONE_PATTERN.test(value),
      "Numéro invalide (ex. 77 123 45 67 ou +221 77 123 45 67).",
    )
    .transform((value) => value || null),
  role: z.enum(ROLES, { message: "Rôle invalide." }),
  jobTitle: optionalText(
    120,
    "La spécialité ne doit pas dépasser 120 caractères.",
  ),
  contractType: z.union([
    z.enum(CONTRACT_TYPES, { message: "Type de contrat invalide." }),
    z.literal("").transform(() => null),
  ]),
  hireDate: z.union([
    z.iso.date("Date invalide."),
    z.literal("").transform(() => null),
  ]),
});

/** Valeurs saisies dans le formulaire (avant nettoyage). */
export type StaffFormValues = z.input<typeof staffSchema>;
/** Valeurs nettoyées, prêtes pour la base. */
export type StaffData = z.output<typeof staffSchema>;

/** Note de suivi (visible par la direction uniquement). */
export const staffNoteSchema = z.object({
  profileId: z.uuid("Fiche invalide."),
  content: z
    .string()
    .trim()
    .max(5000, "La note ne doit pas dépasser 5 000 caractères."),
});

/** Action sur une fiche existante (ex. renvoyer l'invitation). */
export const profileIdSchema = z.object({
  profileId: z.uuid("Fiche invalide."),
});

export type StaffResult = { ok: boolean; message: string; id?: string };
