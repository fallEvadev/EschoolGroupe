import { tz } from "@date-fns/tz";
import { format } from "date-fns";
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

/** Date seule au format jj/mm/aaaa (ex. date d'arrivée). */
export function formatDate(value: string | Date): string {
  return format(value, "dd/MM/yyyy", options);
}
