import { z } from "zod";

/** Affecter un ticket (`profileId` à `null` : retirer l'affectation). */
export const assignTicketSchema = z.object({
  ticketId: z.uuid("Ticket invalide."),
  profileId: z.uuid("Maintenancier invalide.").nullable(),
});

export const archiveTicketSchema = z.object({
  ticketId: z.uuid("Ticket invalide."),
});

/** Prendre un ticket en charge (ouvert -> en cours). */
export const startTicketSchema = z.object({
  ticketId: z.uuid("Ticket invalide."),
});

/** Marquer un ticket résolu : la note d'intervention est obligatoire. */
export const resolveTicketSchema = z.object({
  ticketId: z.uuid("Ticket invalide."),
  note: z
    .string()
    .trim()
    .min(3, "Décrivez l'intervention (au moins 3 caractères).")
    .max(500, "La note ne doit pas dépasser 500 caractères."),
});

export type TicketResult = { ok: boolean; message: string };

/** Rattacher un ticket « Autre équipement » à une machine de l'inventaire. */
export const linkTicketSchema = z.object({
  ticketId: z.uuid("Ticket invalide."),
  machineId: z.uuid("Machine invalide."),
});
