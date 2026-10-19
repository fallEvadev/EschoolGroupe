import { type RowState } from "@/lib/attendance-sheet";
import { dakarIsoDate, monthOf } from "@/lib/dates";

/** Filtres de statut de la vue du jour. */
export const STATUS_FILTERS = [
  { key: "tous", label: "Tous les statuts" },
  { key: "a_verifier", label: "À vérifier" },
  { key: "present", label: "Présents" },
  { key: "retard", label: "Retards" },
  { key: "absent", label: "Absents" },
  { key: "excuse", label: "Excusés" },
  { key: "en_attente", label: "Pas encore pointés" },
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

export function matchesStatus(state: RowState, filter: StatusFilter): boolean {
  if (filter === "tous") return true;
  // Un pointage refusé compte comme une absence.
  if (filter === "absent") return state === "absent" || state === "refuse";
  return state === filter;
}

export type View = {
  vue: "jour" | "mois";
  date: string;
  mois: string;
  ecole: string;
  formateur: string;
  statut: StatusFilter;
};

/** Adresse de la page : seuls les réglages différents des valeurs par défaut y figurent. */
export function href(view: View, change: Partial<View> = {}): string {
  const next = { ...view, ...change };
  const search = new URLSearchParams();
  if (next.vue === "mois") search.set("vue", "mois");
  if (next.vue === "jour" && next.date !== dakarIsoDate()) {
    search.set("date", next.date);
  }
  if (next.vue === "mois" && next.mois !== monthOf(dakarIsoDate())) {
    search.set("mois", next.mois);
  }
  if (next.ecole) search.set("ecole", next.ecole);
  if (next.vue === "jour" && next.formateur) {
    search.set("formateur", next.formateur);
  }
  if (next.vue === "jour" && next.statut !== "tous") {
    search.set("statut", next.statut);
  }
  const query = search.toString();
  return query ? `/admin/pointages?${query}` : "/admin/pointages";
}
