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

// ---------------------------------------------------------------------------
// Calculs sur des dates « aaaa-mm-jj » (jour calendaire, sans heure). Dakar est
// à UTC+0 toute l'année : le calcul en UTC donne le jour de Dakar.
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function isoToUtc(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Vrai pour une vraie date « aaaa-mm-jj » (le 2026-02-30 n'existe pas). */
export function isIsoDate(value: string): boolean {
  return (
    ISO_DATE.test(value) && isoToUtc(value).toISOString().slice(0, 10) === value
  );
}

/** Vrai pour un mois « aaaa-mm ». */
export function isIsoMonth(value: string): boolean {
  return ISO_MONTH.test(value);
}

/** Date décalée de `days` jours (négatif pour reculer). */
export function shiftIsoDate(iso: string, days: number): string {
  const date = isoToUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Jour de la semaine d'une date « aaaa-mm-jj » : 1 = lundi … 7 = dimanche. */
export function isoWeekdayOf(iso: string): number {
  const day = isoToUtc(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Mois « aaaa-mm » d'une date « aaaa-mm-jj ». */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Mois décalé de `delta` mois (« 2026-01 » − 1 = « 2025-12 »). */
export function shiftMonth(month: string, delta: number): string {
  const date = isoToUtc(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

/** Tous les jours d'un mois « aaaa-mm », du 1er au dernier. */
export function monthDays(month: string): string[] {
  const days: string[] = [];
  for (let day = `${month}-01`; monthOf(day) === month;) {
    days.push(day);
    day = shiftIsoDate(day, 1);
  }
  return days;
}

/** Jour en toutes lettres pour une date « aaaa-mm-jj » (ex. « lundi 5 octobre »). */
export function formatIsoLongDate(iso: string): string {
  return formatLongDate(`${iso}T12:00:00Z`);
}

/** Mois en toutes lettres pour « aaaa-mm » (ex. « octobre 2026 »). */
export function formatMonthLabel(month: string): string {
  return format(`${month}-15T12:00:00Z`, "LLLL yyyy", options);
}
