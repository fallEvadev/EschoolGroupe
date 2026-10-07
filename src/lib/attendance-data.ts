import "server-only";

import { isAttendanceStatus, isLocationResult } from "@/lib/attendance";
import type {
  SheetAssignment,
  SheetAttendance,
  SheetClosedDay,
  SheetExcuse,
  SheetReview,
  SheetSlot,
} from "@/lib/attendance-sheet";
import { describeSupabaseError } from "@/lib/supabase/errors";
import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
type QueryError = { code?: string; message: string };

/** Supabase renvoie au plus 1000 lignes par requête, sans le dire. */
const PAGE_SIZE = 1000;

/** Lit toutes les pages d'une requête (par tranches de 1000 lignes). */
async function fetchAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: QueryError | null }>,
): Promise<{ data: T[] } | { error: QueryError }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { error };
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: all };
  }
}

/** Tout ce qu'il faut pour construire les feuilles de pointage d'une période. */
export type SheetData = {
  slots: SheetSlot[];
  assignments: SheetAssignment[];
  attendances: SheetAttendance[];
  reviews: SheetReview[];
  excuses: SheetExcuse[];
  closedDays: SheetClosedDay[];
  schools: { id: string; name: string; status: string }[];
  /** Nom des formateurs, par identifiant de fiche (annuaire minimal). */
  names: Map<string, string>;
};

/**
 * Charge le planning (tous statuts : on reconstruit ce qui était attendu un
 * jour passé), les pointages, décisions, excuses et jours sans cours entre
 * deux dates incluses. Lu avec le jeton de la Direction pédagogique : la RLS
 * s'applique.
 */
export async function loadSheetData(
  supabase: ServerSupabase,
  { from, to }: { from: string; to: string },
): Promise<SheetData | { error: string }> {
  const [
    slotsResult,
    assignmentsResult,
    attendancesResult,
    reviewsResult,
    excusesResult,
    closedResult,
    schoolsResult,
    directoryResult,
  ] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("time_slots")
        .select(
          "id, school_id, weekday, starts_at, ends_at, label, status, created_at, updated_at",
        )
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("slot_assignments")
        .select("id, slot_id, profile_id, status, created_at, updated_at")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("attendances")
        .select(
          "id, profile_id, slot_id, school_id, attendance_date, recorded_at, status, late_minutes, location_result, distance_m, accuracy_m",
        )
        .gte("attendance_date", from)
        .lte("attendance_date", to)
        .order("id")
        .range(a, b),
    ),
    // La jointure ne sert qu'à filtrer les décisions par date de pointage.
    fetchAll((a, b) =>
      supabase
        .from("attendance_reviews")
        .select(
          "id, attendance_id, decision, comment, attendances!inner(attendance_date)",
        )
        .gte("attendances.attendance_date", from)
        .lte("attendances.attendance_date", to)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("absence_excuses")
        .select("id, profile_id, slot_id, absence_date, reason")
        .eq("status", "actif")
        .gte("absence_date", from)
        .lte("absence_date", to)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("closed_days")
        .select("id, closed_date, school_id, reason")
        .eq("status", "actif")
        .gte("closed_date", from)
        .lte("closed_date", to)
        .order("id")
        .range(a, b),
    ),
    supabase.from("schools").select("id, name, status").order("name"),
    supabase.rpc("pedagogy_staff_directory"),
  ]);

  const failures: [string, QueryError | null][] = [
    ["time_slots", "error" in slotsResult ? slotsResult.error : null],
    [
      "slot_assignments",
      "error" in assignmentsResult ? assignmentsResult.error : null,
    ],
    [
      "attendances",
      "error" in attendancesResult ? attendancesResult.error : null,
    ],
    [
      "attendance_reviews",
      "error" in reviewsResult ? reviewsResult.error : null,
    ],
    ["absence_excuses", "error" in excusesResult ? excusesResult.error : null],
    ["closed_days", "error" in closedResult ? closedResult.error : null],
    ["schools", schoolsResult.error],
    ["pedagogy_staff_directory", directoryResult.error],
  ];
  for (const [table, error] of failures) {
    if (error) return { error: describeSupabaseError(table, error).message };
  }
  if (
    "error" in slotsResult ||
    "error" in assignmentsResult ||
    "error" in attendancesResult ||
    "error" in reviewsResult ||
    "error" in excusesResult ||
    "error" in closedResult ||
    schoolsResult.error ||
    directoryResult.error
  ) {
    return { error: "Données indisponibles pour le moment." };
  }

  return {
    slots: slotsResult.data.map((row) => ({
      id: row.id,
      schoolId: row.school_id,
      weekday: row.weekday,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      label: row.label,
      createdAt: row.created_at,
      // Un créneau n'est jamais modifié : sa date d'archivage est sa dernière mise à jour.
      archivedAt: row.status === "archive" ? row.updated_at : null,
    })),
    assignments: assignmentsResult.data.map((row) => ({
      slotId: row.slot_id,
      profileId: row.profile_id,
      createdAt: row.created_at,
      archivedAt: row.status === "archive" ? row.updated_at : null,
    })),
    attendances: attendancesResult.data.flatMap((row) =>
      isAttendanceStatus(row.status) && isLocationResult(row.location_result)
        ? [
            {
              id: row.id,
              profileId: row.profile_id,
              slotId: row.slot_id,
              schoolId: row.school_id,
              date: row.attendance_date,
              recordedAt: row.recorded_at,
              status: row.status,
              lateMinutes: row.late_minutes,
              locationResult: row.location_result,
              distanceM: row.distance_m,
              accuracyM: row.accuracy_m,
            },
          ]
        : [],
    ),
    reviews: reviewsResult.data.map((row) => ({
      attendanceId: row.attendance_id,
      decision: row.decision === "valide" ? "valide" : "refuse",
      comment: row.comment,
    })),
    excuses: excusesResult.data.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      slotId: row.slot_id,
      date: row.absence_date,
      reason: row.reason,
    })),
    closedDays: closedResult.data.map((row) => ({
      id: row.id,
      date: row.closed_date,
      schoolId: row.school_id,
      reason: row.reason,
    })),
    schools: schoolsResult.data,
    names: new Map(directoryResult.data.map((p) => [p.id, p.full_name])),
  };
}
