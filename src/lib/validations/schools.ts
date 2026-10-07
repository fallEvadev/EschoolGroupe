import { z } from "zod";

/** Champ facultatif : une chaîne vide devient `null`. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

/**
 * Coordonnée saisie dans un champ texte : vide (→ `null`) ou un nombre dans
 * l'intervalle. La virgule décimale est acceptée (« 16,0326 »).
 */
const coordinate = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .refine(
      (value) =>
        value === "" ||
        (Number.isFinite(Number(value)) &&
          Number(value) >= min &&
          Number(value) <= max),
      `${label} invalide (entre ${min} et ${max}).`,
    )
    .transform((value) => (value === "" ? null : Number(value)));

/** Heure « HH:MM » sur 24 h. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Fiche d'une école (création et modification). */
export const schoolSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(120, "Le nom ne doit pas dépasser 120 caractères."),
    address: optionalText(
      250,
      "L'adresse ne doit pas dépasser 250 caractères.",
    ),
    latitude: coordinate("Latitude", -90, 90),
    longitude: coordinate("Longitude", -180, 180),
    radiusM: z
      .number({ message: "Rayon invalide." })
      .int("Le rayon doit être un nombre entier de mètres.")
      .min(20, "Le rayon doit être d'au moins 20 m.")
      .max(5000, "Le rayon ne doit pas dépasser 5 000 m."),
    lateToleranceMinutes: z
      .number({ message: "Tolérance invalide." })
      .int("La tolérance doit être un nombre entier de minutes.")
      .min(0, "La tolérance ne peut pas être négative.")
      .max(180, "La tolérance ne doit pas dépasser 180 minutes."),
  })
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    message:
      "Renseignez la latitude et la longitude ensemble, ou aucune des deux.",
    path: ["longitude"],
  });

/** Valeurs saisies dans le formulaire (avant nettoyage). */
export type SchoolFormValues = z.input<typeof schoolSchema>;
/** Valeurs nettoyées, prêtes pour la base. */
export type SchoolData = z.output<typeof schoolSchema>;

/** Créneau hebdomadaire d'une école. */
export const slotSchema = z
  .object({
    schoolId: z.uuid("École invalide."),
    weekday: z
      .number({ message: "Jour invalide." })
      .int("Jour invalide.")
      .min(1, "Jour invalide.")
      .max(7, "Jour invalide."),
    startsAt: z.string().regex(TIME_PATTERN, "Heure de début invalide."),
    endsAt: z.string().regex(TIME_PATTERN, "Heure de fin invalide."),
    label: optionalText(60, "Le libellé ne doit pas dépasser 60 caractères."),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "L'heure de fin doit être après l'heure de début.",
    path: ["endsAt"],
  });

export type SlotFormValues = z.input<typeof slotSchema>;
export type SlotData = z.output<typeof slotSchema>;

/** Affectation d'un formateur à un créneau. */
export const assignmentSchema = z.object({
  slotId: z.uuid("Créneau invalide."),
  profileId: z.uuid("Personne invalide."),
});

/** Rattachement d'un directeur partenaire à une école. */
export const directorLinkSchema = z.object({
  schoolId: z.uuid("École invalide."),
  profileId: z.uuid("Personne invalide."),
});

export const schoolIdSchema = z.object({ schoolId: z.uuid("École invalide.") });
export const slotIdSchema = z.object({ slotId: z.uuid("Créneau invalide.") });
export const assignmentIdSchema = z.object({
  assignmentId: z.uuid("Affectation invalide."),
});

/** Archivage ou restauration d'une école. */
export const schoolStatusSchema = z.object({
  schoolId: z.uuid("École invalide."),
  status: z.enum(["actif", "archive"], { message: "Statut invalide." }),
});

export type SchoolResult = { ok: boolean; message: string; id?: string };
