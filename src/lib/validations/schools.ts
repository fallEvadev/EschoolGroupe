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

/**
 * Fiche d'une école (création et modification). La position GPS et le rayon n'y
 * figurent plus : le directeur enregistre la position sur place, et le rayon
 * est fixé (150 m, valeur par défaut de la base).
 */
export const schoolSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom ne doit pas dépasser 120 caractères."),
  address: optionalText(250, "L'adresse ne doit pas dépasser 250 caractères."),
  lateToleranceMinutes: z
    .number({ message: "Tolérance invalide." })
    .int("La tolérance doit être un nombre entier de minutes.")
    .min(0, "La tolérance ne peut pas être négative.")
    .max(180, "La tolérance ne doit pas dépasser 180 minutes."),
});

/** Valeurs saisies dans le formulaire (avant nettoyage). */
export type SchoolFormValues = z.input<typeof schoolSchema>;
/** Valeurs nettoyées, prêtes pour la base. */
export type SchoolData = z.output<typeof schoolSchema>;

/** Coordonnée obligatoire : comme `coordinate`, mais le champ vide est refusé. */
const requiredCoordinate = (label: string, min: number, max: number) =>
  coordinate(label, min, max).refine(
    (value): value is number => value !== null,
    `${label} obligatoire.`,
  );

/**
 * Position saisie à la main par la Direction pédagogique (secours : le plus
 * simple reste que le directeur l'enregistre sur place).
 */
export const schoolPositionSchema = z.object({
  schoolId: z.uuid("École invalide."),
  latitude: requiredCoordinate("Latitude", -90, 90),
  longitude: requiredCoordinate("Longitude", -180, 180),
});

export type SchoolPositionFormValues = z.input<typeof schoolPositionSchema>;
export type SchoolPositionData = z.output<typeof schoolPositionSchema>;

/**
 * Position relevée par le téléphone du directeur, sur place. Le serveur
 * revérifie la précision : une position trop imprécise est refusée.
 */
export const directorPositionSchema = z.object({
  schoolId: z.uuid("École invalide."),
  latitude: z.number({ message: "Latitude invalide." }).min(-90).max(90),
  longitude: z.number({ message: "Longitude invalide." }).min(-180).max(180),
  accuracyM: z
    .number({ message: "Précision invalide." })
    .min(0, "Précision invalide.")
    .max(1_000_000, "Précision invalide."),
});

export type DirectorPositionInput = z.input<typeof directorPositionSchema>;

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
