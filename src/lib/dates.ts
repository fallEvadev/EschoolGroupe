import { tz } from "@date-fns/tz";
import { format, getISODay } from "date-fns";
import { fr } from "date-fns/locale";

/** Fuseau horaire de la plateforme. */
export const TIME_ZONE = "Africa/Dakar";

const options = { locale: fr, in: tz(TIME_ZONE) };

/** Date et heure au format jj/mm/aaaa hh:mm, heure de Dakar. */
export function formatDateTime(value: string | Date): string {
  return format(value, "dd/MM/yyyy HH:mm", options);
}

/** Date en toutes lettres pour les en-têtes (ex. « lundi 5 octobre »). */
export function formatLongDate(value: string | Date): string {
  return format(value, "EEEE d MMMM", options);
}

/**
 * Jour courant à Dakar au format aaaa-mm-jj (celui des colonnes `date` de la
 * base, ex. le jour de validité d'un code). Passer `now` pour les tests.
 */
export function dakarIsoDate(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd", { in: tz(TIME_ZONE) });
}

/** Minutes écoulées depuis minuit à Dakar (ex. 08:30 → 510). */
export function dakarMinutes(now: Date = new Date()): number {
  const [hours = 0, minutes = 0] = format(now, "HH:mm", { in: tz(TIME_ZONE) })
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
}

/** Jour de la semaine à Dakar, 1 = lundi … 7 = dimanche (norme ISO). */
export function dakarIsoWeekday(now: Date = new Date()): number {
  return getISODay(now, { in: tz(TIME_ZONE) });
}

/** Heure seule « hh:mm » à Dakar (ex. heure d'un pointage). */
export function formatClock(value: string | Date): string {
  return format(value, "HH:mm", options);
}

/** Date seule au format jj/mm/aaaa (ex. date d'arrivée). */
export function formatDate(value: string | Date): string {
  return format(value, "dd/MM/yyyy", options);
}
