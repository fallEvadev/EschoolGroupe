import { ROLE_LABELS, parseRole } from "@/lib/auth/roles";
import { isoWeekdayOf, shiftIsoDate } from "@/lib/dates";

/** Une série d'un graphique : son nom et ses statuts (plusieurs statuts peuvent se regrouper). */
export type SeriesDef = {
  label: string;
  /** Statuts de la base regroupés dans cette série. */
  statuses: readonly string[];
  /** Variable de thème de la couleur : `chart-1`, `chart-2` ou `chart-3`. */
  color: "chart-1" | "chart-2" | "chart-3";
};

/** Pointages : à l'heure, en retard, position à vérifier. */
export const ATTENDANCE_SERIES: readonly SeriesDef[] = [
  { label: "À l'heure", statuses: ["present"], color: "chart-1" },
  { label: "En retard", statuses: ["retard"], color: "chart-2" },
  { label: "À vérifier", statuses: ["a_verifier"], color: "chart-3" },
];

/** Rapports envoyés : validés (avec ou sans corrections), à traiter, à modifier. */
export const REPORT_SERIES: readonly SeriesDef[] = [
  {
    label: "Validés",
    statuses: ["valide", "valide_avec_corrections"],
    color: "chart-1",
  },
  { label: "À traiter", statuses: ["soumis"], color: "chart-2" },
  { label: "À modifier", statuses: ["a_modifier"], color: "chart-3" },
];

/** Les `count` derniers jours, du plus ancien à aujourd'hui (inclus), « aaaa-mm-jj ». */
export function lastDays(todayIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    shiftIsoDate(todayIso, i - (count - 1)),
  );
}

/** Lundi de la semaine qui contient cette date. */
export function mondayOf(iso: string): string {
  return shiftIsoDate(iso, 1 - isoWeekdayOf(iso));
}

/** Les lundis des `count` dernières semaines, de la plus ancienne à la semaine en cours. */
export function lastWeeks(todayIso: string, count: number): string[] {
  const current = mondayOf(todayIso);
  return Array.from({ length: count }, (_, i) =>
    shiftIsoDate(current, 7 * (i - (count - 1))),
  );
}

/** « 2026-10-05 » → « 05/10 » (étiquette courte d'un axe). */
export function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Une ligne de totaux renvoyée par la base : un repère (jour ou semaine), un statut, un nombre. */
export type CountRow = { bucket: string; status: string; count: number };

/**
 * Totaux par repère et par série : `result[i][j]` est le nombre de la série `j`
 * pour le repère `i`. Un repère sans ligne vaut 0 ; les statuts qui ne sont dans
 * aucune série sont ignorés.
 */
export function buildSeries(
  buckets: readonly string[],
  rows: readonly CountRow[],
  series: readonly SeriesDef[],
): number[][] {
  const index = new Map(buckets.map((bucket, i) => [bucket, i]));
  const result = buckets.map(() => series.map(() => 0));
  for (const row of rows) {
    const i = index.get(row.bucket);
    if (i === undefined) continue;
    const j = series.findIndex((s) => s.statuses.includes(row.status));
    const line = result[i];
    if (j >= 0 && line) line[j] = (line[j] ?? 0) + row.count;
  }
  return result;
}

/** Somme d'une colonne de `buildSeries` (une série sur tous les repères). */
export function seriesTotal(
  values: readonly number[][],
  column: number,
): number {
  return values.reduce((sum, line) => sum + (line[column] ?? 0), 0);
}

/**
 * Plus grand nombre « rond » au-dessus de la valeur (1, 2, 5, 10, 20, 50…), pour
 * que l'axe vertical porte des graduations lisibles. Au moins 1.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 1) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * base) return step * base;
  }
  return 10 * base;
}

/** Graduations de l'axe vertical : 0, la moitié et le maximum (sans doublon). */
export function axisTicks(max: number): number[] {
  const half = max / 2;
  return Number.isInteger(half) && half > 0 ? [0, half, max] : [0, max];
}

export type RoleCount = { role: string; label: string; count: number };

/**
 * Personnel ACTIF par rôle, du plus nombreux au moins nombreux. Les rôles
 * inconnus et les comptes qui ne sont pas actifs sont ignorés.
 */
export function activeStaffByRole(
  rows: readonly { role: string; status: string; count: number }[],
): RoleCount[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "actif" || !parseRole(row.role)) continue;
    totals.set(row.role, (totals.get(row.role) ?? 0) + row.count);
  }
  return [...totals.entries()]
    .map(([role, count]) => ({
      role,
      label: ROLE_LABELS[parseRole(role) ?? "formateur"],
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}

/** Nombre de comptes dans ce statut, tous rôles confondus. */
export function countWithStatus(
  rows: readonly { status: string; count: number }[],
  status: string,
): number {
  return rows
    .filter((row) => row.status === status)
    .reduce((sum, row) => sum + row.count, 0);
}
