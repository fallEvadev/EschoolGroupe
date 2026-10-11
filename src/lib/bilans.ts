import {
  formatDate,
  formatMonthLabel,
  isIsoDate,
  isIsoMonth,
  isoWeekdayOf,
  monthDays,
  monthOf,
  shiftIsoDate,
  shiftMonth,
} from "@/lib/dates";

/** Types de période d'un bilan (même liste que la contrainte SQL de `bilans.period_kind`). */
export const BILAN_KINDS = ["semaine", "mois"] as const;
export type BilanKind = (typeof BILAN_KINDS)[number];

export const BILAN_KIND_LABELS: Record<BilanKind, string> = {
  semaine: "Semaine",
  mois: "Mois",
};

export function isBilanKind(value: unknown): value is BilanKind {
  return (
    typeof value === "string" &&
    (BILAN_KINDS as readonly string[]).includes(value)
  );
}

/** Statuts d'un bilan (même liste que la contrainte SQL de `bilans.status`). */
export const BILAN_STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  publie: "Publié",
};

/** Lundi de la semaine qui contient cette date (« aaaa-mm-jj »). */
export function mondayOf(iso: string): string {
  return shiftIsoDate(iso, 1 - isoWeekdayOf(iso));
}

/** Dernier jour de la semaine commençant ce lundi : le dimanche. */
export function weekEnd(monday: string): string {
  return shiftIsoDate(monday, 6);
}

/** Dernier jour du mois qui commence à cette date (le 1er). */
export function monthEnd(firstDay: string): string {
  const days = monthDays(monthOf(firstDay));
  return days[days.length - 1] ?? firstDay;
}

/**
 * Début de période (en base) à partir de ce que la personne a saisi : n'importe
 * quel jour pour une semaine (on prend son lundi), un mois « aaaa-mm » pour un
 * mois (on prend le 1er). `null` si la saisie est invalide.
 */
export function periodStartFrom(kind: BilanKind, value: string): string | null {
  if (kind === "semaine") return isIsoDate(value) ? mondayOf(value) : null;
  return isIsoMonth(value) ? `${value}-01` : null;
}

/**
 * Période proposée par défaut : la dernière période TERMINÉE (la semaine ou le
 * mois précédent), car c'est celle dont on fait le bilan.
 */
export function defaultPeriodStart(kind: BilanKind, todayIso: string): string {
  if (kind === "semaine") return shiftIsoDate(mondayOf(todayIso), -7);
  return `${shiftMonth(monthOf(todayIso), -1)}-01`;
}

/** Valeur à remettre dans le champ de saisie pour un début de période. */
export function periodInputValue(kind: BilanKind, start: string): string {
  return kind === "semaine" ? start : monthOf(start);
}

/** Libellé lisible : « Semaine du 05/10/2026 au 11/10/2026 » ou « Octobre 2026 ». */
export function periodLabel(kind: BilanKind, start: string): string {
  if (kind === "semaine") {
    return `Semaine du ${formatDate(`${start}T12:00:00Z`)} au ${formatDate(`${weekEnd(start)}T12:00:00Z`)}`;
  }
  const label = formatMonthLabel(monthOf(start));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Phrase de résultat après « Générer » : combien de bilans créés, actualisés, ignorés. */
export function summarizeGeneration(
  outcomes: { outcome: string; pdfReset?: boolean }[],
): string {
  if (outcomes.length === 0) {
    return "Aucun rapport validé sur cette période : aucun bilan à générer.";
  }
  const count = (name: string) =>
    outcomes.filter((o) => o.outcome === name).length;
  const parts: string[] = [];
  const created = count("cree");
  const updated = count("actualise");
  const ignored = count("ignore");
  if (created > 0) parts.push(`${created} créé${created > 1 ? "s" : ""}`);
  if (updated > 0) parts.push(`${updated} actualisé${updated > 1 ? "s" : ""}`);
  if (ignored > 0) {
    parts.push(
      `${ignored} déjà publié${ignored > 1 ? "s" : ""} (inchangé${ignored > 1 ? "s" : ""})`,
    );
  }
  const reset = outcomes.filter((o) => o.pdfReset).length;
  const base = `Bilans : ${parts.join(", ")}.`;
  return reset > 0
    ? `${base} Des rapports ont été ajoutés : le PDF de ${reset} bilan${reset > 1 ? "s" : ""} est à redéposer.`
    : base;
}
