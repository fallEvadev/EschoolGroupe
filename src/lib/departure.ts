import { formatMinutes } from "@/lib/attendance";
import { timeToMinutes } from "@/lib/schools";

/**
 * Où en est un pointage qui exige une descente. Le rapport journalier ne
 * s'ouvre qu'une fois la descente validée (code du directeur, ou Direction
 * pédagogique si le directeur est absent).
 *  - `legacy` : ancien pointage, sans descente : le rapport reste libre ;
 *  - `closed` : le cours n'est pas fini, le code ne sera accepté qu'à sa fin ;
 *  - `awaiting_code` : le cours est fini, le code du directeur est attendu ;
 *  - `expired` : le jour est passé sans descente (c'est à la Direction d'agir) ;
 *  - `done` : descente validée, le rapport est ouvert.
 */
export type DepartureStage =
  | { stage: "legacy" }
  | { stage: "closed"; endsAtMinutes: number }
  | { stage: "awaiting_code" }
  | { stage: "expired" }
  | { stage: "done"; source: "code" | "direction" };

export function departureStage({
  requiresDeparture,
  departedAt,
  departureSource,
  endsAt,
  isToday,
  nowMinutes,
}: {
  requiresDeparture: boolean;
  departedAt: string | null;
  departureSource: string | null;
  /** Fin du créneau, « HH:MM » ou « HH:MM:SS ». */
  endsAt: string;
  /** Le pointage date d'aujourd'hui (heure de Dakar). */
  isToday: boolean;
  nowMinutes: number;
}): DepartureStage {
  if (!requiresDeparture) return { stage: "legacy" };
  if (departedAt) {
    return {
      stage: "done",
      source: departureSource === "direction" ? "direction" : "code",
    };
  }
  if (!isToday) return { stage: "expired" };

  const end = timeToMinutes(endsAt);
  if (nowMinutes < end) return { stage: "closed", endsAtMinutes: end };
  return { stage: "awaiting_code" };
}

/** Le formulaire du rapport peut-il être ouvert (créé) à ce stade ? */
export function reportIsOpen(stage: DepartureStage): boolean {
  return stage.stage === "legacy" || stage.stage === "done";
}

/** Phrase courte décrivant le stage pour le formateur. */
export function departureMessage(stage: DepartureStage): string | null {
  switch (stage.stage) {
    case "legacy":
      return null;
    case "closed":
      return `Le cours se termine à ${formatMinutes(stage.endsAtMinutes)}. Ensuite, le directeur vous donne le code : en le saisissant, vous validez votre descente et le rapport s'ouvre.`;
    case "awaiting_code":
      return "Le cours est terminé. Saisissez le code donné par le directeur : votre descente sera validée et le rapport s'ouvrira.";
    case "expired":
      return "La descente n'a pas été validée le jour du cours. Contactez la Direction pédagogique : le rapport s'ouvre une fois la descente validée.";
    case "done":
      return stage.source === "direction"
        ? "Descente validée par la Direction pédagogique : vous pouvez rédiger votre rapport."
        : "Descente validée : vous pouvez rédiger votre rapport.";
  }
}

/** Durée entre l'arrivée et la descente, ex. « 3 h 55 » ; `null` si l'ordre est incohérent. */
export function formatDuration(
  startIso: string,
  endIso: string,
): string | null {
  const minutes = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
  );
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0
    ? `${rest} min`
    : `${hours} h ${String(rest).padStart(2, "0")}`;
}
