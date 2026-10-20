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

/**
 * Une panne signalée dans un rapport. `machineId` désigne la machine de
 * l'inventaire de l'école ; `null` pour « Autre équipement » (nom libre dans
 * `equipment`). Pour une machine de l'inventaire, `equipment` garde son nom au
 * moment du rapport, pour que l'historique reste lisible si elle est renommée.
 */
export type EquipmentIssue = {
  machineId: string | null;
  equipment: string;
  description: string;
};

/** Une ligne de panne vide, pour « Ajouter une panne ». */
export function emptyIssue(): EquipmentIssue {
  return { machineId: null, equipment: "", description: "" };
}

/**
 * Un cours donné pendant le créneau : le formateur en saisit autant qu'il en a
 * donné (08h–09h en CI B, puis 10h–11h en CM1…). Les heures sont en « HH:MM ».
 * L'effectif est le nombre d'élèves présents ; `null` tant qu'il n'est pas saisi
 * (brouillon).
 */
export type Course = {
  startsAt: string;
  endsAt: string;
  classes: string;
  theme: string;
  headcount: number | null;
};

export const MAX_COURSES = 12;
export const MAX_HEADCOUNT = 500;

/** Un cours vide, pour « Ajouter un cours » (le début reprend la fin du précédent). */
export function emptyCourse(startsAt = "", endsAt = ""): Course {
  return { startsAt, endsAt, classes: "", theme: "", headcount: null };
}

/** Contenu saisi par le formateur. */
export type ReportContent = {
  courses: Course[];
  equipmentOk: boolean;
  issues: EquipmentIssue[];
};

/** Rapport vierge : un premier cours, avec les heures du créneau si on les connaît. */
export function emptyContent(slotStart = "", slotEnd = ""): ReportContent {
  return {
    courses: [emptyCourse(hhmm(slotStart), hhmm(slotEnd))],
    equipmentOk: true,
    issues: [],
  };
}

export const EMPTY_CONTENT: ReportContent = emptyContent();

/** « 08:00:00 » devient « 08:00 » ; une valeur vide reste vide. */
export function hhmm(value: string): string {
  return value.slice(0, 5);
}

export const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const MAX_ISSUES = 20;

/**
 * Relit les cours stockés en JSON. Tolérant : une ligne mal formée est ignorée.
 * Un rapport d'avant les cours multiples n'a que « classes » et « thème » : il
 * devient un seul cours, sans heures ni effectif.
 */
export function parseCourses(
  value: Json,
  legacyClasses = "",
  legacyTheme = "",
): Course[] {
  const courses: Course[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      courses.push({
        startsAt: typeof item.startsAt === "string" ? item.startsAt : "",
        endsAt: typeof item.endsAt === "string" ? item.endsAt : "",
        classes: typeof item.classes === "string" ? item.classes : "",
        theme: typeof item.theme === "string" ? item.theme : "",
        headcount:
          typeof item.headcount === "number" &&
          Number.isInteger(item.headcount)
            ? item.headcount
            : null,
      });
    }
  }
  if (courses.length === 0 && (legacyClasses !== "" || legacyTheme !== "")) {
    courses.push({
      startsAt: "",
      endsAt: "",
      classes: legacyClasses,
      theme: legacyTheme,
      headcount: null,
    });
  }
  return courses;
}

/**
 * Résumé en deux textes (classes, thèmes) gardé dans `daily_reports.classes` et
 * `course_theme`, pour que les bilans et les anciennes lectures continuent de
 * fonctionner. Écrit par le serveur, jamais par le navigateur.
 */
export function summarizeCourses(courses: readonly Course[]): {
  classes: string;
  courseTheme: string;
} {
  const names = [
    ...new Set(courses.map((c) => c.classes.trim()).filter((c) => c !== "")),
  ];
  const themes = courses
    .filter((c) => c.theme.trim() !== "")
    .map((c) =>
      courses.length > 1 && c.classes.trim() !== ""
        ? `${c.classes.trim()} : ${c.theme.trim()}`
        : c.theme.trim(),
    );
  return {
    classes: names.join(", ").slice(0, 300),
    courseTheme: themes.join(" · ").slice(0, 1000),
  };
}

/** « 08:00–09:00 », « 08:00 » ou vide selon ce qui est renseigné. */
export function courseHours(course: Pick<Course, "startsAt" | "endsAt">): string {
  const start = hhmm(course.startsAt);
  const end = hhmm(course.endsAt);
  if (start && end) return `${start}–${end}`;
  return start || end;
}

/** « 28 élèves » ; vide si l'effectif n'est pas connu. */
export function headcountLabel(headcount: number | null): string {
  if (headcount === null) return "";
  return `${headcount} ${headcount > 1 ? "élèves" : "élève"}`;
}

/**
 * Premier manque d'une liste de cours complète, ou `null`. Sert à l'envoi côté
 * navigateur ; le serveur refait le même contrôle avec Zod.
 */
export function missingInCourses(courses: readonly Course[]): string | null {
  if (courses.length === 0) return "Ajoutez au moins un cours.";
  for (const [i, course] of courses.entries()) {
    const n = courses.length > 1 ? ` (cours ${i + 1})` : "";
    if (!TIME_FORMAT.test(course.startsAt)) {
      return `Indiquez l'heure de début${n}.`;
    }
    if (!TIME_FORMAT.test(course.endsAt)) {
      return `Indiquez l'heure de fin${n}.`;
    }
    if (toMinutes(course.endsAt) <= toMinutes(course.startsAt)) {
      return `L'heure de fin doit être après l'heure de début${n}.`;
    }
    if (course.classes.trim().length < 2) {
      return `Indiquez la classe${n}.`;
    }
    if (course.theme.trim().length < 3) {
      return `Indiquez le thème du cours${n}.`;
    }
    if (course.headcount === null) {
      return `Indiquez l'effectif des élèves${n}.`;
    }
  }
  const sorted = [...courses].sort(
    (a, b) => toMinutes(a.startsAt) - toMinutes(b.startsAt),
  );
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (
      previous &&
      current &&
      toMinutes(current.startsAt) < toMinutes(previous.endsAt)
    ) {
      return "Deux cours ne peuvent pas se chevaucher.";
    }
  }
  return null;
}

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
      issues.push({
        // Les rapports d'avant le Lot 5 n'ont pas de machine : `null`.
        machineId: typeof item.machineId === "string" ? item.machineId : null,
        equipment: item.equipment,
        description: item.description,
      });
    }
  }
  return issues;
}

/** Un rapport est-il complet pour être envoyé ? Renvoie le premier manque. */
export function missingForSubmit(content: ReportContent): string | null {
  const course = missingInCourses(content.courses);
  if (course) return course;
  if (!content.equipmentOk && content.issues.length === 0) {
    return "Ajoutez au moins une difficulté, ou indiquez que tout fonctionne.";
  }
  return null;
}

/** Types d'entrées de l'historique d'un rapport (même liste que la base). */
export const REVISION_LABELS: Record<string, string> = {
  soumission: "Envoyé par le formateur",
  resoumission: "Renvoyé par le formateur",
  correction: "Validé avec corrections",
  validation: "Validé",
  demande_modification: "Modification demandée",
};

/** Un rapport vu par la Direction. */
export type ReviewItem = {
  id: string;
  date: string;
  schoolName: string;
  formateurName: string;
  startsAt: string;
  endsAt: string;
  status: ReportStatus;
  content: ReportContent;
  submittedAt: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  history: {
    version: number;
    kind: string;
    createdAt: string;
    comment: string | null;
  }[];
};

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
