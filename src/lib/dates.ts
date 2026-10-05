/** Fuseau horaire de la plateforme. */
export const TIME_ZONE = "Africa/Dakar";

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const longDateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Date en toutes lettres pour les en-têtes (ex. « lundi 5 octobre »). */
export function formatLongDate(value: string | Date): string {
  return longDateFormat.format(new Date(value));
}

/** Date et heure au format jj/mm/aaaa hh:mm, heure de Dakar. */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormat.format(new Date(value)).replace(",", "");
}
