import "server-only";

import { auth } from "@clerk/nextjs/server";

import type { AgendaSlot, SlotAttendance } from "@/lib/agenda";
import { isAttendanceStatus } from "@/lib/attendance";
import { dakarIsoDate } from "@/lib/dates";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type Agenda = {
  /** Nom du formateur connecté, `null` s'il n'a pas de fiche (ex. Super-Admin). */
  fullName: string | null;
  /** Tous ses créneaux de la semaine. */
  slots: AgendaSlot[];
  /** Pointages d'aujourd'hui, par identifiant de créneau. */
  todayAttendances: Map<string, SlotAttendance>;
};

/**
 * Planning du formateur connecté et ses pointages du jour. Lu avec SON jeton :
 * la RLS ne lui montre que ses affectations, les créneaux et les écoles
 * concernés, et ses propres pointages.
 */
export async function loadAgenda(): Promise<Agenda | { error: string }> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  const { userId } = await auth();
  const supabase = await createServerSupabase();

  const [profileResult, assignmentsResult, attendancesResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("clerk_user_id", userId ?? "")
        .maybeSingle(),
      supabase.from("slot_assignments").select("slot_id").eq("status", "actif"),
      supabase
        .from("attendances")
        .select("id, slot_id, status, recorded_at, late_minutes")
        .eq("attendance_date", dakarIsoDate()),
    ]);

  for (const [table, result] of [
    ["profiles", profileResult],
    ["slot_assignments", assignmentsResult],
    ["attendances", attendancesResult],
  ] as const) {
    if (result.error) {
      return { error: describeSupabaseError(table, result.error).message };
    }
  }

  const slotIds = (assignmentsResult.data ?? []).map((row) => row.slot_id);
  let slots: AgendaSlot[] = [];
  if (slotIds.length > 0) {
    const slotsResult = await supabase
      .from("time_slots")
      .select("id, school_id, weekday, starts_at, ends_at, label")
      .in("id", slotIds)
      .eq("status", "actif");
    if (slotsResult.error) {
      return {
        error: describeSupabaseError("time_slots", slotsResult.error).message,
      };
    }

    const schoolIds = [...new Set(slotsResult.data.map((s) => s.school_id))];
    const schoolsResult = await supabase
      .from("schools")
      .select("id, name")
      .in("id", schoolIds);
    if (schoolsResult.error) {
      return {
        error: describeSupabaseError("schools", schoolsResult.error).message,
      };
    }
    const names = new Map(schoolsResult.data.map((s) => [s.id, s.name]));

    slots = slotsResult.data.map((slot) => ({
      id: slot.id,
      schoolId: slot.school_id,
      schoolName: names.get(slot.school_id) ?? "École",
      weekday: slot.weekday,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      label: slot.label,
    }));
  }

  // Décisions de la Direction sur les pointages du jour (la RLS ne montre au
  // formateur que celles qui le concernent).
  const attendanceRows = attendancesResult.data ?? [];
  const reviews = new Map<
    string,
    { decision: "valide" | "refuse"; comment: string | null }
  >();
  if (attendanceRows.length > 0) {
    const reviewsResult = await supabase
      .from("attendance_reviews")
      .select("attendance_id, decision, comment")
      .in(
        "attendance_id",
        attendanceRows.map((row) => row.id),
      );
    if (reviewsResult.error) {
      return {
        error: describeSupabaseError("attendance_reviews", reviewsResult.error)
          .message,
      };
    }
    for (const row of reviewsResult.data) {
      reviews.set(row.attendance_id, {
        decision: row.decision === "valide" ? "valide" : "refuse",
        comment: row.comment,
      });
    }
  }

  const todayAttendances = new Map<string, SlotAttendance>();
  for (const row of attendanceRows) {
    if (isAttendanceStatus(row.status)) {
      todayAttendances.set(row.slot_id, {
        status: row.status,
        recordedAt: row.recorded_at,
        lateMinutes: row.late_minutes,
        review: reviews.get(row.id),
      });
    }
  }

  return {
    fullName: profileResult.data?.full_name ?? null,
    slots,
    todayAttendances,
  };
}
