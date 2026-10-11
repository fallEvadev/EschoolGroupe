import { z } from "zod";

/** Affecter un ticket (`profileId` à `null` : retirer l'affectation). */
export const assignTicketSchema = z.object({
  ticketId: z.uuid("Ticket invalide."),
  profileId: z.uuid("Maintenancier invalide.").nullable(),
});

export const archiveTicketSchema = z.object({
  ticketId: z.uuid("Ticket invalide."),
});

export type TicketResult = { ok: boolean; message: string };
