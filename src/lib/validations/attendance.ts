import { z } from "zod";

import { CODE_LENGTH } from "@/lib/daily-codes";
import type { AttendanceStatus, LocationResult } from "@/lib/attendance";

/**
 * Pointage d'arrivée envoyé par le téléphone du formateur : le créneau et la
 * position relevée (ou la raison pour laquelle elle manque). Pas de code à
 * l'arrivée : le code du directeur sert à valider la DESCENTE. Le formateur
 * n'est JAMAIS désigné ici : son identité vient de son jeton de connexion.
 */
export const attendanceSchema = z.object({
  slotId: z.uuid("Créneau invalide."),
  position: z.discriminatedUnion(
    "status",
    [
      z.object({
        status: z.literal("ok"),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracyM: z.number().min(0).max(1_000_000),
      }),
      z.object({ status: z.literal("refusee") }),
      z.object({ status: z.literal("indisponible") }),
    ],
    { message: "Position invalide." },
  ),
});

export type AttendanceInput = z.input<typeof attendanceSchema>;

/** Réponse du serveur à un pointage d'arrivée. */
export type AttendanceResult =
  | {
      ok: true;
      status: AttendanceStatus;
      /** Instant du pointage (ISO), à afficher en heure de Dakar. */
      recordedAt: string;
      fullName: string;
      schoolName: string;
      lateMinutes: number;
      locationResult: LocationResult;
      /** Phrase expliquant un pointage « à vérifier », sinon `null`. */
      explanation: string | null;
    }
  | { ok: false; message: string };

/**
 * Descente : le pointage concerné et le code donné par le directeur après le
 * cours. Là encore, le formateur n'est jamais désigné : il vient du jeton.
 */
export const departureSchema = z.object({
  attendanceId: z.uuid("Pointage invalide."),
  code: z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d{${CODE_LENGTH}}$`),
      `Le code a ${CODE_LENGTH} chiffres.`,
    ),
});

export type DepartureInput = z.input<typeof departureSchema>;

/** Réponse du serveur à une descente. */
export type DepartureResult =
  | { ok: true; message: string; departedAt: string }
  | { ok: false; message: string };
