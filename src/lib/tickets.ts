/** Statuts d'un ticket (même liste que la contrainte SQL de `maintenance_tickets.status`). */
export const TICKET_STATUSES = [
  "ouvert",
  "en_cours",
  "resolu",
  "archive",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

export const TICKET_LABELS: Record<TicketStatus, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
  archive: "Archivé",
};

export const TICKET_BADGE: Record<
  TicketStatus,
  "neutral" | "default" | "success" | "warning" | "destructive"
> = {
  ouvert: "warning",
  en_cours: "default",
  resolu: "success",
  archive: "neutral",
};

/** Filtres de la liste. « actifs » (ouverts et en cours) est le filtre par défaut. */
export const TICKET_FILTERS = [
  "actifs",
  "ouvert",
  "en_cours",
  "resolu",
  "archive",
  "tous",
] as const;

export type TicketFilter = (typeof TICKET_FILTERS)[number];

export const TICKET_FILTER_LABELS: Record<TicketFilter, string> = {
  actifs: "À traiter",
  ouvert: "Ouverts",
  en_cours: "En cours",
  resolu: "Résolus",
  archive: "Archivés",
  tous: "Tous",
};

/** Filtre lu dans l'adresse de la page ; une valeur inconnue donne le défaut. */
export function parseTicketFilter(value: unknown): TicketFilter {
  return typeof value === "string" &&
    (TICKET_FILTERS as readonly string[]).includes(value)
    ? (value as TicketFilter)
    : "actifs";
}

export function matchesFilter(status: string, filter: TicketFilter): boolean {
  if (filter === "tous") return true;
  if (filter === "actifs") return status === "ouvert" || status === "en_cours";
  return status === filter;
}

/** Un ticket qu'on peut affecter : tant qu'il n'est ni résolu ni archivé. */
export function canAssign(status: string): boolean {
  return status === "ouvert" || status === "en_cours";
}

/**
 * Un ticket qu'on peut archiver : ouvert (fausse alerte, sans intervention) ou
 * résolu (rangement). Un ticket « en cours » est en train d'être traité.
 */
export function canArchive(status: string): boolean {
  return status === "ouvert" || status === "resolu";
}

type SortableTicket = { status: string; openedAt: string };

const RANK: Record<string, number> = {
  ouvert: 0,
  en_cours: 1,
  resolu: 2,
  archive: 3,
};

/**
 * À traiter d'abord, les plus anciens en premier (ce qui attend depuis le plus
 * longtemps) ; résolus et archivés ensuite, les plus récents en premier.
 */
export function sortTickets<T extends SortableTicket>(tickets: T[]): T[] {
  return [...tickets].sort((a, b) => {
    const byStatus = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
    if (byStatus !== 0) return byStatus;
    const open = a.status === "ouvert" || a.status === "en_cours";
    return open
      ? a.openedAt.localeCompare(b.openedAt)
      : b.openedAt.localeCompare(a.openedAt);
  });
}
