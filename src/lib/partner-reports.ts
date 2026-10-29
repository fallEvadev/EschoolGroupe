import { hhmm, parseCourses, type Course } from "@/lib/reports";
import type { Json } from "@/types/database";

/** Ligne renvoyée par la fonction SQL `partner_reports`. */
export type PartnerReportRow = {
  out_id: string;
  out_school_id: string;
  out_school_name: string;
  out_report_date: string;
  out_slot_starts: string;
  out_slot_ends: string;
  out_formateur: string;
  out_courses: Json;
  out_classes: string;
  out_course_theme: string;
};

/** Rapport validé tel que le directeur le lit : rien d'autre n'est transmis. */
export type PartnerReport = {
  id: string;
  schoolId: string;
  schoolName: string;
  /** Jour du cours, « AAAA-MM-JJ ». */
  date: string;
  /** Horaire du créneau, « HH:MM–HH:MM ». */
  slot: string;
  formateur: string;
  courses: Course[];
};

export function toPartnerReport(row: PartnerReportRow): PartnerReport {
  return {
    id: row.out_id,
    schoolId: row.out_school_id,
    schoolName: row.out_school_name,
    date: row.out_report_date,
    slot: `${hhmm(row.out_slot_starts)}–${hhmm(row.out_slot_ends)}`,
    formateur: row.out_formateur,
    // Un rapport d'avant les cours multiples devient un seul cours.
    courses: parseCourses(
      row.out_courses,
      row.out_classes,
      row.out_course_theme,
    ),
  };
}

/** Rapports d'un même jour, du plus récent au plus ancien. */
export type ReportDay = { date: string; reports: PartnerReport[] };

/**
 * Regroupe par jour en gardant l'ordre reçu (la base trie déjà du plus récent
 * au plus ancien). Si `schoolId` est donné, ne garde que cette école.
 */
export function groupReportsByDay(
  reports: readonly PartnerReport[],
  schoolId: string | null = null,
): ReportDay[] {
  const days: ReportDay[] = [];
  for (const report of reports) {
    if (schoolId && report.schoolId !== schoolId) continue;
    const last = days[days.length - 1];
    if (last && last.date === report.date) last.reports.push(report);
    else days.push({ date: report.date, reports: [report] });
  }
  return days;
}

/** Écoles présentes dans les rapports, par ordre alphabétique. */
export function schoolsOf(
  reports: readonly PartnerReport[],
): { id: string; name: string }[] {
  const byId = new Map(reports.map((r) => [r.schoolId, r.schoolName]));
  return [...byId]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** « 08:00–09:00 · 3e A · Algèbre · 25 élèves » (les éléments vides sautent). */
export function courseLine(course: Course): string {
  const hours =
    course.startsAt && course.endsAt
      ? `${course.startsAt}–${course.endsAt}`
      : "";
  const headcount =
    course.headcount === null
      ? ""
      : `${course.headcount} élève${course.headcount > 1 ? "s" : ""}`;
  return [hours, course.classes, course.theme, headcount]
    .filter((part) => part !== "")
    .join(" · ");
}
