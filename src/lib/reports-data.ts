import "server-only";

import {
  isReportStatus,
  parseIssues,
  sortReportItems,
  type ReportContent,
  type ReportListItem,
  type ReportStatus,
  type ReviewItem,
} from "@/lib/reports";
import { dakarIsoDate, shiftIsoDate } from "@/lib/dates";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

/** Fenêtre de la liste : les pointages des 30 derniers jours. */
const LIST_DAYS = 30;

const CONFIG_ERROR =
  "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.";

/**
 * Pointages récents du formateur connecté avec leur rapport. Lu avec SON jeton :
 * la RLS ne lui montre que ses pointages et ses rapports.
 */
export async function loadReportList(): Promise<
  { items: ReportListItem[] } | { error: string }
> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();
  const since = shiftIsoDate(dakarIsoDate(), -LIST_DAYS);

  const attendancesResult = await supabase
    .from("attendances")
    .select("id, slot_id, school_id, attendance_date")
    .gte("attendance_date", since)
    .order("attendance_date", { ascending: false })
    .limit(200);
  if (attendancesResult.error) {
    return {
      error: describeSupabaseError("attendances", attendancesResult.error)
        .message,
    };
  }
  const attendances = attendancesResult.data;
  if (attendances.length === 0) return { items: [] };

  const attendanceIds = attendances.map((a) => a.id);
  const slotIds = [...new Set(attendances.map((a) => a.slot_id))];
  const schoolIds = [...new Set(attendances.map((a) => a.school_id))];

  const [reportsResult, slotsResult, schoolsResult, reviewsResult] =
    await Promise.all([
      supabase
        .from("daily_reports")
        .select("id, attendance_id, status")
        .in("attendance_id", attendanceIds),
      supabase
        .from("time_slots")
        .select("id, starts_at, ends_at")
        .in("id", slotIds),
      supabase.from("schools").select("id, name").in("id", schoolIds),
      supabase
        .from("attendance_reviews")
        .select("attendance_id")
        .eq("decision", "refuse")
        .in("attendance_id", attendanceIds),
    ]);
  for (const [table, result] of [
    ["daily_reports", reportsResult],
    ["time_slots", slotsResult],
    ["schools", schoolsResult],
    ["attendance_reviews", reviewsResult],
  ] as const) {
    if (result.error) {
      return { error: describeSupabaseError(table, result.error).message };
    }
  }

  const reports = new Map<string, { id: string; status: ReportStatus }>();
  for (const row of reportsResult.data ?? []) {
    if (isReportStatus(row.status)) {
      reports.set(row.attendance_id, { id: row.id, status: row.status });
    }
  }
  const slots = new Map(
    (slotsResult.data ?? []).map((s) => [s.id, s] as const),
  );
  const schools = new Map(
    (schoolsResult.data ?? []).map((s) => [s.id, s.name] as const),
  );
  // Un pointage refusé par la Direction compte comme une absence : pas de rapport.
  const refused = new Set(
    (reviewsResult.data ?? []).map((r) => r.attendance_id),
  );

  const items: ReportListItem[] = attendances
    .filter((a) => !refused.has(a.id) || reports.has(a.id))
    .map((a) => ({
      attendanceId: a.id,
      date: a.attendance_date,
      schoolName: schools.get(a.school_id) ?? "École",
      startsAt: slots.get(a.slot_id)?.starts_at ?? "",
      endsAt: slots.get(a.slot_id)?.ends_at ?? "",
      report: reports.get(a.id) ?? null,
    }));

  return { items: sortReportItems(items) };
}

/** Combien de décisions récentes la Direction revoit sous les rapports à traiter. */
const RECENT_DECISIONS = 30;
const MAX_PENDING = 100;

const REVIEW_COLUMNS =
  "id, attendance_id, profile_id, school_id, slot_id, report_date, status, classes, course_theme, equipment_ok, equipment_issues, review_comment, submitted_at, reviewed_at";

/**
 * Rapports vus par la Direction pédagogique : ceux à traiter (envoyés, du plus
 * ancien au plus récent) et les dernières décisions. Lu avec SON jeton : la RLS
 * ne lui montre pas les brouillons. Les noms des formateurs viennent de
 * l'annuaire minimal (la Direction ne lit pas `profiles`).
 */
export async function loadReviewQueue(): Promise<
  { pending: ReviewItem[]; decided: ReviewItem[] } | { error: string }
> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();

  const [pendingResult, decidedResult, directoryResult] = await Promise.all([
    supabase
      .from("daily_reports")
      .select(REVIEW_COLUMNS)
      .eq("status", "soumis")
      .order("submitted_at", { ascending: true })
      .limit(MAX_PENDING),
    supabase
      .from("daily_reports")
      .select(REVIEW_COLUMNS)
      .in("status", ["valide", "valide_avec_corrections", "a_modifier"])
      .order("reviewed_at", { ascending: false })
      .limit(RECENT_DECISIONS),
    supabase.rpc("pedagogy_staff_directory"),
  ]);
  for (const [table, result] of [
    ["daily_reports", pendingResult],
    ["daily_reports", decidedResult],
    ["pedagogy_staff_directory", directoryResult],
  ] as const) {
    if (result.error) {
      return { error: describeSupabaseError(table, result.error).message };
    }
  }

  const rows = [...(pendingResult.data ?? []), ...(decidedResult.data ?? [])];
  if (rows.length === 0) return { pending: [], decided: [] };

  const reportIds = rows.map((r) => r.id);
  const slotIds = [...new Set(rows.map((r) => r.slot_id))];
  const schoolIds = [...new Set(rows.map((r) => r.school_id))];
  const [slotsResult, schoolsResult, revisionsResult] = await Promise.all([
    supabase
      .from("time_slots")
      .select("id, starts_at, ends_at")
      .in("id", slotIds),
    supabase.from("schools").select("id, name").in("id", schoolIds),
    supabase
      .from("report_revisions")
      .select("report_id, version, kind, created_at, comment")
      .in("report_id", reportIds)
      .order("version", { ascending: true }),
  ]);
  for (const [table, result] of [
    ["time_slots", slotsResult],
    ["schools", schoolsResult],
    ["report_revisions", revisionsResult],
  ] as const) {
    if (result.error) {
      return { error: describeSupabaseError(table, result.error).message };
    }
  }

  const slots = new Map(
    (slotsResult.data ?? []).map((s) => [s.id, s] as const),
  );
  const schools = new Map(
    (schoolsResult.data ?? []).map((s) => [s.id, s.name] as const),
  );
  const people = new Map(
    (directoryResult.data ?? []).map((p) => [p.id, p.full_name] as const),
  );
  const history = new Map<string, ReviewItem["history"]>();
  for (const rev of revisionsResult.data ?? []) {
    const list = history.get(rev.report_id) ?? [];
    list.push({
      version: rev.version,
      kind: rev.kind,
      createdAt: rev.created_at,
      comment: rev.comment,
    });
    history.set(rev.report_id, list);
  }

  const toItem = (row: (typeof rows)[number]): ReviewItem[] =>
    isReportStatus(row.status)
      ? [
          {
            id: row.id,
            date: row.report_date,
            schoolName: schools.get(row.school_id) ?? "École",
            formateurName: people.get(row.profile_id) ?? "Formateur",
            startsAt: slots.get(row.slot_id)?.starts_at ?? "",
            endsAt: slots.get(row.slot_id)?.ends_at ?? "",
            status: row.status,
            content: {
              classes: row.classes,
              courseTheme: row.course_theme,
              equipmentOk: row.equipment_ok,
              issues: parseIssues(row.equipment_issues),
            },
            submittedAt: row.submitted_at,
            reviewComment: row.review_comment,
            reviewedAt: row.reviewed_at,
            history: history.get(row.id) ?? [],
          },
        ]
      : [];

  return {
    pending: (pendingResult.data ?? []).flatMap(toItem),
    decided: (decidedResult.data ?? []).flatMap(toItem),
  };
}

/** Un rapport (ou son absence) pour un pointage, avec le contexte à afficher. */
export type ReportDetail = {
  attendanceId: string;
  date: string;
  schoolName: string;
  startsAt: string;
  endsAt: string;
  /** Le pointage a été refusé par la Direction : aucun rapport possible. */
  refused: boolean;
  report: {
    id: string;
    status: ReportStatus;
    content: ReportContent;
    reviewComment: string | null;
  } | null;
};

/**
 * Détail d'un pointage du formateur connecté et de son rapport. `null` si le
 * pointage n'existe pas ou n'est pas le sien (la RLS le masque).
 */
export async function loadReportDetail(
  attendanceId: string,
): Promise<ReportDetail | null | { error: string }> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();

  const attendanceResult = await supabase
    .from("attendances")
    .select("id, slot_id, school_id, attendance_date")
    .eq("id", attendanceId)
    .maybeSingle();
  if (attendanceResult.error) {
    return {
      error: describeSupabaseError("attendances", attendanceResult.error)
        .message,
    };
  }
  const attendance = attendanceResult.data;
  if (!attendance) return null;

  const [slotResult, schoolResult, reportResult, reviewResult] =
    await Promise.all([
      supabase
        .from("time_slots")
        .select("starts_at, ends_at")
        .eq("id", attendance.slot_id)
        .maybeSingle(),
      supabase
        .from("schools")
        .select("name")
        .eq("id", attendance.school_id)
        .maybeSingle(),
      supabase
        .from("daily_reports")
        .select(
          "id, status, classes, course_theme, equipment_ok, equipment_issues, review_comment",
        )
        .eq("attendance_id", attendanceId)
        .maybeSingle(),
      supabase
        .from("attendance_reviews")
        .select("decision")
        .eq("attendance_id", attendanceId)
        .maybeSingle(),
    ]);
  for (const [table, result] of [
    ["time_slots", slotResult],
    ["schools", schoolResult],
    ["daily_reports", reportResult],
    ["attendance_reviews", reviewResult],
  ] as const) {
    if (result.error) {
      return { error: describeSupabaseError(table, result.error).message };
    }
  }

  const row = reportResult.data;
  return {
    attendanceId,
    date: attendance.attendance_date,
    schoolName: schoolResult.data?.name ?? "École",
    startsAt: slotResult.data?.starts_at ?? "",
    endsAt: slotResult.data?.ends_at ?? "",
    refused: reviewResult.data?.decision === "refuse",
    report:
      row && isReportStatus(row.status)
        ? {
            id: row.id,
            status: row.status,
            content: {
              classes: row.classes,
              courseTheme: row.course_theme,
              equipmentOk: row.equipment_ok,
              issues: parseIssues(row.equipment_issues),
            },
            reviewComment: row.review_comment,
          }
        : null,
  };
}
