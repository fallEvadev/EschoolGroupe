import "server-only";

import {
  activeStaffByRole,
  ATTENDANCE_SERIES,
  buildSeries,
  countWithStatus,
  lastDays,
  lastWeeks,
  REPORT_SERIES,
  type RoleCount,
} from "@/lib/dashboard";
import { computeTicketStats, type TicketStats } from "@/lib/ticket-stats";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const CONFIG_ERROR =
  "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.";

/** Fenêtres des graphiques : 14 jours pour les pointages, 8 semaines pour le reste. */
export const DASHBOARD_DAYS = 14;
export const DASHBOARD_WEEKS = 8;

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
type Failure = { error: string };

export type PedagogyDashboard = {
  days: string[];
  /** Pointages par jour : à l'heure, en retard, à vérifier. */
  attendance: number[][];
  weeks: string[];
  /** Rapports envoyés par semaine : validés, à traiter, à modifier. */
  reports: number[][];
  /** Rapports envoyés qui attendent une décision (toutes périodes). */
  reportsToTreat: number;
  /** Bilans encore en brouillon. */
  draftBilans: number;
};

/**
 * Chiffres de la Direction pédagogique. Tout est calculé par la base (fonctions
 * `dashboard_*`) : seulement des totaux, avec les droits de l'utilisateur.
 */
export async function loadPedagogyDashboard(
  today: string,
): Promise<PedagogyDashboard | Failure> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();
  const days = lastDays(today, DASHBOARD_DAYS);
  const weeks = lastWeeks(today, DASHBOARD_WEEKS);

  const [attendanceResult, reportsResult, toTreatResult, bilansResult] =
    await Promise.all([
      supabase.rpc("dashboard_attendance_by_day", { p_from: days[0] ?? today }),
      supabase.rpc("dashboard_reports_by_week", { p_from: weeks[0] ?? today }),
      supabase
        .from("daily_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "soumis"),
      supabase
        .from("bilans")
        .select("id", { count: "exact", head: true })
        .eq("status", "brouillon"),
    ]);

  for (const [name, error] of [
    ["dashboard_attendance_by_day", attendanceResult.error],
    ["dashboard_reports_by_week", reportsResult.error],
    ["daily_reports", toTreatResult.error],
    ["bilans", bilansResult.error],
  ] as const) {
    if (error) return { error: describeSupabaseError(name, error).message };
  }

  return {
    days,
    attendance: buildSeries(
      days,
      (attendanceResult.data ?? []).map((row) => ({
        bucket: row.out_day,
        status: row.out_status,
        count: row.out_count,
      })),
      ATTENDANCE_SERIES,
    ),
    weeks,
    reports: buildSeries(
      weeks,
      (reportsResult.data ?? []).map((row) => ({
        bucket: row.out_week,
        status: row.out_status,
        count: row.out_count,
      })),
      REPORT_SERIES,
    ),
    reportsToTreat: toTreatResult.count ?? 0,
    draftBilans: bilansResult.count ?? 0,
  };
}

export type HrDashboard = {
  activeTotal: number;
  pendingInvitations: number;
  documentsToCheck: number;
  byRole: RoleCount[];
};

/** Chiffres des Ressources humaines : des totaux, jamais de nom ni d'adresse. */
export async function loadHrDashboard(): Promise<HrDashboard | Failure> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();

  const [staffResult, documentsResult] = await Promise.all([
    supabase.rpc("dashboard_staff_by_role"),
    supabase
      .from("staff_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "actif")
      .eq("review_status", "a_verifier"),
  ]);
  for (const [name, error] of [
    ["dashboard_staff_by_role", staffResult.error],
    ["staff_documents", documentsResult.error],
  ] as const) {
    if (error) return { error: describeSupabaseError(name, error).message };
  }

  const rows = (staffResult.data ?? []).map((row) => ({
    role: row.out_role,
    status: row.out_status,
    count: row.out_count,
  }));
  const byRole = activeStaffByRole(rows);

  return {
    activeTotal: byRole.reduce((sum, row) => sum + row.count, 0),
    pendingInvitations: countWithStatus(rows, "invite"),
    documentsToCheck: documentsResult.count ?? 0,
    byRole,
  };
}

export type MaintenanceDashboard = {
  stats: TicketStats;
  /** Les 8 dernières semaines (lundis) et le nombre de tickets ouverts chaque semaine. */
  weeks: string[];
  opened: number[][];
  /** Écoles avec des pannes à traiter ou en cours. */
  bySchool: { label: string; value: number }[];
};

async function schoolNames(
  supabase: ServerSupabase,
): Promise<Map<string, string> | Failure> {
  const { data, error } = await supabase.rpc("maintenance_schools");
  if (error) {
    return {
      error: describeSupabaseError("maintenance_schools", error).message,
    };
  }
  return new Map(data.map((s) => [s.id, s.name]));
}

/** Chiffres de la maintenance : tickets par statut, par semaine et par école. */
export async function loadMaintenanceDashboard(
  today: string,
): Promise<MaintenanceDashboard | Failure> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();
  const weeks = lastWeeks(today, DASHBOARD_WEEKS);

  const [ticketsResult, weeklyResult, names] = await Promise.all([
    supabase
      .from("maintenance_tickets")
      .select("school_id, status, opened_at, resolved_at")
      .limit(1000),
    supabase.rpc("dashboard_tickets_by_week", { p_from: weeks[0] ?? today }),
    schoolNames(supabase),
  ]);
  for (const [name, error] of [
    ["maintenance_tickets", ticketsResult.error],
    ["dashboard_tickets_by_week", weeklyResult.error],
  ] as const) {
    if (error) return { error: describeSupabaseError(name, error).message };
  }
  if ("error" in names) return names;

  // Les tuiles se calculent sur les tickets lus (au plus 1 000, largement assez
  // pour les statuts en cours) ; les semaines viennent de la base, sans limite.
  const stats = computeTicketStats(
    (ticketsResult.data ?? []).map((t) => ({
      schoolId: t.school_id,
      status: t.status,
      openedAt: t.opened_at,
      resolvedAt: t.resolved_at,
    })),
    new Date(),
  );

  return {
    stats,
    weeks,
    opened: buildSeries(
      weeks,
      (weeklyResult.data ?? []).map((row) => ({
        bucket: row.out_week,
        status: "ouvert",
        count: row.out_count,
      })),
      [{ label: "Tickets ouverts", statuses: ["ouvert"], color: "chart-1" }],
    ),
    bySchool: stats.bySchool
      .filter((row) => row.open > 0)
      .slice(0, 6)
      .map((row) => ({
        label: names.get(row.schoolId) ?? "École",
        value: row.open,
      })),
  };
}
