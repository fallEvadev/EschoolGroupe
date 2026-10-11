import { z } from "zod";

import { MACHINE_KINDS } from "@/lib/machines";

const labelField = z
  .string()
  .trim()
  .min(1, "Donnez un nom à la machine (ex. : PC 4).")
  .max(60, "Le nom ne doit pas dépasser 60 caractères.");

const kindField = z.enum(MACHINE_KINDS, { message: "Type invalide." });

/** Numéro de série facultatif : une chaîne vide devient `null`. */
const serialField = z
  .string()
  .trim()
  .max(80, "Le numéro de série ne doit pas dépasser 80 caractères.")
  .transform((value) => value || null);

/** Ajout d'une machine à l'inventaire d'une école. */
export const machineSchema = z.object({
  schoolId: z.uuid("École invalide."),
  label: labelField,
  kind: kindField,
  serialNumber: serialField,
});

/** Modification : l'école ne change jamais (la base le refuse aussi). */
export const machineUpdateSchema = z.object({
  machineId: z.uuid("Machine invalide."),
  label: labelField,
  kind: kindField,
  serialNumber: serialField,
});

export const machineStatusSchema = z.object({
  machineId: z.uuid("Machine invalide."),
  status: z.enum(["actif", "archive"], { message: "Statut invalide." }),
});

/** Valeurs saisies dans le formulaire (avant nettoyage). */
export type MachineFormValues = z.input<typeof machineSchema>;

export type MachineResult = { ok: boolean; message: string; id?: string };
