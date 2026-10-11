/** Fenêtre des « résolus récemment » : 30 jours. */
export const RECENT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type StatTicket = {
  schoolId: string;
  status: string;
  openedAt: string;
  resolvedAt: string | null;
};

export type SchoolStat = {
  schoolId: string;
  /** Tickets à traiter ou en cours. */
  open: number;
  /** Tous les tickets de l'école, quel que soit leur statut. */
  total: number;
};

export type TicketStats = {
  /** Tickets ouverts, pas encore pris en charge. */
  toTreat: number;
  /** Tickets en cours de traitement. */
  inProgress: number;
  /** Tickets résolus durant les 30 derniers jours. */
  resolvedRecently: number;
  /** Délai moyen d'ouverture à résolution (ms) sur ces tickets, `null` s'il n'y en a pas. */
  averageResolutionMs: number | null;
  bySchool: SchoolStat[];
};

/**
 * Chiffres de suivi de la maintenance. Un ticket archivé après sa résolution
 * compte comme résolu (sa date de résolution est conservée) ; un ticket archivé
 * sans intervention (fausse alerte) n'a pas de date de résolution et ne compte pas.
 */
export function computeTicketStats(
  tickets: StatTicket[],
  now: Date,
): TicketStats {
  const since = now.getTime() - RECENT_DAYS * DAY_MS;
  let toTreat = 0;
  let inProgress = 0;
  const delays: number[] = [];
  const schools = new Map<string, SchoolStat>();

  for (const ticket of tickets) {
    const school = schools.get(ticket.schoolId) ?? {
      schoolId: ticket.schoolId,
      open: 0,
      total: 0,
    };
    school.total += 1;

    if (ticket.status === "ouvert") {
      toTreat += 1;
      school.open += 1;
    } else if (ticket.status === "en_cours") {
      inProgress += 1;
      school.open += 1;
    }
    schools.set(ticket.schoolId, school);

    if (ticket.resolvedAt) {
      const resolved = new Date(ticket.resolvedAt).getTime();
      const opened = new Date(ticket.openedAt).getTime();
      if (resolved >= since && Number.isFinite(opened) && resolved >= opened) {
        delays.push(resolved - opened);
      }
    }
  }

  return {
    toTreat,
    inProgress,
    resolvedRecently: delays.length,
    averageResolutionMs:
      delays.length === 0
        ? null
        : delays.reduce((sum, d) => sum + d, 0) / delays.length,
    bySchool: [...schools.values()].sort(
      (a, b) => b.open - a.open || b.total - a.total,
    ),
  };
}

/** Durée lisible : « moins d'1 h », « 5 h » ou « 3 j » (arrondi). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < HOUR_MS) return "moins d'1 h";
  if (ms < 2 * DAY_MS) return `${Math.round(ms / HOUR_MS)} h`;
  return `${Math.round(ms / DAY_MS)} j`;
}
