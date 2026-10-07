/** Rayon par défaut autour d'une école (mètres), réglable par école. */
export const DEFAULT_RADIUS_M = 150;

/** Minutes de grâce par défaut avant le statut « retard », réglables par école. */
export const DEFAULT_LATE_TOLERANCE_MINUTES = 15;

/** Jours de la semaine, numérotés comme la norme ISO (1 = lundi … 7 = dimanche). */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

export function isWeekday(value: number): value is Weekday {
  return (WEEKDAYS as readonly number[]).includes(value);
}

/** « 08:00:00 » (format de la base) → « 08:00 ». */
export function formatTime(value: string): string {
  return value.slice(0, 5);
}

/** Minutes écoulées depuis minuit pour « HH:MM » ou « HH:MM:SS ». */
export function timeToMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** Un créneau hebdomadaire : un jour, une heure de début et une heure de fin. */
export type SlotRange = {
  weekday: number;
  startsAt: string;
  endsAt: string;
};

/** Deux créneaux se chevauchent-ils ? Bout à bout (10:00 et 10:00) ne compte pas. */
export function slotsOverlap(a: SlotRange, b: SlotRange): boolean {
  if (a.weekday !== b.weekday) return false;
  return (
    timeToMinutes(a.startsAt) < timeToMinutes(b.endsAt) &&
    timeToMinutes(b.startsAt) < timeToMinutes(a.endsAt)
  );
}

/** Premier créneau existant qui chevauche le candidat, ou `null`. */
export function findOverlap<T extends SlotRange>(
  candidate: SlotRange,
  existing: readonly T[],
): T | null {
  return existing.find((slot) => slotsOverlap(candidate, slot)) ?? null;
}

/** « Lundi · 08:00–10:00 », avec le libellé s'il y en a un. */
export function formatSlot(
  slot: SlotRange & { label?: string | null },
): string {
  const day = isWeekday(slot.weekday) ? WEEKDAY_LABELS[slot.weekday] : "Jour ?";
  const range = `${formatTime(slot.startsAt)}–${formatTime(slot.endsAt)}`;
  return slot.label ? `${day} · ${range} (${slot.label})` : `${day} · ${range}`;
}

/** Lien qui ouvre la position dans une carte, pour vérifier les coordonnées. */
export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
