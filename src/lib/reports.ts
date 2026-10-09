import type { Json } from "@/types/database";

/** Statuts d'un rapport journalier (même liste que la contrainte SQL). */
export const REPORT_STATUSES = [
  "brouillon",
  "soumis",
  "valide",
  "valide_avec_corrections",
  "a_modifier",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function isReportStatus(value: string): value is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(value);
}

export const REPORT_LABELS: Record<ReportStatus, string> = {
  brouillon: "Brouillon",
  soumis: "Envoyé",
  valide: "Validé",
  valide_avec_corrections: "Validé avec corrections",
  a_modifier: "À modifier",
};

export const REPORT_BADGE: Record<
  ReportStatus,
  "neutral" | "default" | "success" | "warning" | "destructive"
> = {
  brouillon: "neutral",
  soumis: "default",
  valide: "success",
  valide_avec_corrections: "success",
  a_modifier: "warning",
};

/** Le formateur ne modifie que son brouillon ou un rapport renvoyé. */
export function isEditable(status: ReportStatus): boolean {
  return status === "brouillon" || status === "a_modifier";
}

/** Un rapport validé (avec ou sans corrections) est verrouillé. */
export function isLocked(status: ReportStatus): boolean {
  return status === "valide" || status === "valide_avec_corrections";
}

/** Une panne signalée dans un rapport. */
export type EquipmentIssue = { equipment: string; description: string };

/** Contenu saisi par le formateur. */
export type ReportContent = {
  classes: string;
  courseTheme: string;
  equipmentOk: boolean;
  issues: EquipmentIssue[];
};

export const EMPTY_CONTENT: ReportContent = {
  classes: "",
  courseTheme: "",
  equipmentOk: true,
  issues: [],
};

export const MAX_ISSUES = 20;

/**
 * Relit les pannes stockées en JSON. Tolérant : une ligne mal formée est
 * ignorée plutôt que de faire planter la page.
 */
export function parseIssues(value: Json): EquipmentIssue[] {
  if (!Array.isArray(value)) return [];
  const issues: EquipmentIssue[] = [];
  for (const item of value) {
    if (
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof item.equipment === "string" &&
      typeof item.description === "string"
    ) {
      issues.push({ equipment: item.equipment, description: item.description });
    }
  }
  return issues;
}

/** Un rapport est-il complet pour être envoyé ? Renvoie le premier manque. */
export function missingForSubmit(content: ReportContent): string | null {
  if (content.classes.trim().length < 2) {
    return "Indiquez la ou les classes.";
  }
  if (content.courseTheme.trim().length < 3) {
    return "Indiquez le thème du cours.";
  }
  if (!content.equipmentOk && content.issues.length === 0) {
    return "Ajoutez au moins une panne, ou indiquez que le matériel fonctionne.";
  }
  return null;
}

/** Ce qui apparaît dans la liste : un pointage et son rapport éventuel. */
export type ReportListItem = {
  attendanceId: string;
  date: string;
  schoolName: string;
  startsAt: string;
  endsAt: string;
  report: { id: string; status: ReportStatus } | null;
};

/** Texte d'état d'une ligne de la liste. */
export function reportStateLabel(item: ReportListItem): string {
  return item.report ? REPORT_LABELS[item.report.status] : "À rédiger";
}

/** Les rapports qui demandent une action du formateur, en premier. */
export function sortReportItems(items: ReportListItem[]): ReportListItem[] {
  const rank = (item: ReportListItem) => {
    if (!item.report) return 0;
    if (item.report.status === "a_modifier") return 0;
    if (item.report.status === "brouillon") return 1;
    return 2;
  };
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || b.date.localeCompare(a.date),
  );
}
