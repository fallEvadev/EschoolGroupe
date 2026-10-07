import { z } from "zod";

import { isIsoDate } from "@/lib/dates";

/** Date « aaaa-mm-jj » qui existe vraiment (le 2026-02-30 est refusé). */
const isoDate = z.string().refine(isIsoDate, "Date invalide.");

/** Décision de la Direction sur un pointage « à vérifier ». */
export const reviewAttendanceSchema = z
  .object({
    attendanceId: z.uuid("Pointage invalide."),
    decision: z.enum(["valide", "refuse"], { message: "Décision invalide." }),
    comment: z
      .string()
      .trim()
      .max(500, "Le commentaire ne doit pas dépasser 500 caractères."),
  })
  // Le formateur lit ce motif : un refus ne se justifie pas par le silence.
  .refine((value) => value.decision !== "refuse" || value.comment.length >= 3, {
    message: "Le motif du refus est obligatoire (3 caractères minimum).",
    path: ["comment"],
  });

/** Absence excusée avec un motif. */
export const excuseAbsenceSchema = z.object({
  profileId: z.uuid("Formateur invalide."),
  slotId: z.uuid("Créneau invalide."),
  date: isoDate,
  reason: z
    .string()
    .trim()
    .min(3, "Le motif est obligatoire (3 caractères minimum).")
    .max(500, "Le motif ne doit pas dépasser 500 caractères."),
});

export const excuseIdSchema = z.object({
  excuseId: z.uuid("Excuse invalide."),
});

/** Jour sans cours : pour toutes les écoles (`schoolId` vide) ou une seule. */
export const closeDaySchema = z.object({
  date: isoDate,
  schoolId: z.uuid("École invalide.").nullable(),
  reason: z
    .string()
    .trim()
    .min(3, "Le motif est obligatoire (3 caractères minimum).")
    .max(200, "Le motif ne doit pas dépasser 200 caractères."),
});

export const closedDayIdSchema = z.object({
  closedDayId: z.uuid("Jour invalide."),
});

export type FollowUpResult = { ok: boolean; message: string };
