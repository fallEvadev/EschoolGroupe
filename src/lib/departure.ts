import { formatMinutes } from "@/lib/attendance";
import { timeToMinutes } from "@/lib/schools";

/**
 * Le rapport s'ouvre 10 minutes avant la fin du cours. Même valeur que dans la
 * base (`guard_report_window`) : à changer ensemble.
 */
export const REPORT_OPENS_BEFORE_END_MINUTES = 10;

/**
 * Où en est un pointage qui exige une descente.
 *  - `legacy` : ancien pointage, sans descente ni fenêtre de rapport ;
 *  - `closed` : le rapport n'est pas encore ouvert ;
 *  - `report_open` : le rapport est ouvert, le cours n'est pas fini ;
 *  - `awaiting_code` : le cours est fini, le code du directeur est attendu ;
 *  - `expired` : le jour est passé sans descente (c'est à la Direction d'agir) ;
 *  - `done` : descente validée.
 */
export type DepartureStage =
  | { stage: "legacy" }
  | { stage: "closed"; opensAtMinutes: number }
  | { stage: "report_open"; endsAtMinutes: number }
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
  const opensAt = end - REPORT_OPENS_BEFORE_END_MINUTES;
  if (nowMinutes < opensAt) {
    return { stage: "closed", opensAtMinutes: Math.max(0, opensAt) };
  }
  if (nowMinutes < end) return { stage: "report_open", endsAtMinutes: end };
  return { stage: "awaiting_code" };
}

/** Le formulaire du rapport peut-il être rempli à ce stade ? */
export function reportIsOpen(stage: DepartureStage): boolean {
  return stage.stage !== "closed";
}

/** Phrase courte décrivant le stage pour le formateur. */
export function departureMessage(stage: DepartureStage): string | null {
  switch (stage.stage) {
    case "legacy":
      return null;
    case "closed":
      return `Le rapport s'ouvre à ${formatMinutes(stage.opensAtMinutes)}, 10 minutes avant la fin du cours.`;
    case "report_open":
      return `Vous pouvez rédiger votre rapport. Le cours se termine à ${formatMinutes(stage.endsAtMinutes)} : le directeur vous donnera ensuite le code de descente.`;
    case "awaiting_code":
      return "Le cours est terminé. Saisissez le code donné par le directeur pour valider votre descente.";
    case "expired":
      return "La descente n'a pas été validée le jour du cours. Contactez la Direction pédagogique.";
    case "done":
      return stage.source === "direction"
        ? "Descente validée par la Direction pédagogique."
        : "Descente validée.";
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
