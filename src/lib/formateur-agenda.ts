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
        "Le service n'est pas encore configuré. Contactez l'administrateur technique.",
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
        .select(
          "id, slot_id, status, recorded_at, late_minutes, requires_departure, departed_at, departure_source",
        )
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
  const attendanceRows = attendancesResult.data ?? [];

  // Les créneaux (puis leurs écoles) et les décisions de la Direction sur les
  // pointages du jour n'ont rien à voir entre eux : on les lit en même temps.
  // La base est distante, chaque attente en moins se voit à l'écran. La RLS ne
  // montre au formateur que les décisions qui le concernent.
  const [slotsOutcome, reviewsResult] = await Promise.all([
    loadSlots(supabase, slotIds),
    attendanceRows.length > 0
      ? supabase
          .from("attendance_reviews")
          .select("attendance_id, decision, comment")
          .in(
            "attendance_id",
            attendanceRows.map((row) => row.id),
          )
      : Promise.resolve(null),
  ]);
  if ("error" in slotsOutcome) return { error: slotsOutcome.error };
  const slots = slotsOutcome.slots;
  if (reviewsResult?.error) {
    return {
      error: describeSupabaseError("attendance_reviews", reviewsResult.error)
        .message,
    };
  }

  const reviews = new Map<
    string,
    { decision: "valide" | "refuse"; comment: string | null }
  >();
  for (const row of reviewsResult?.data ?? []) {
    reviews.set(row.attendance_id, {
      decision: row.decision === "valide" ? "valide" : "refuse",
      comment: row.comment,
    });
  }

  const todayAttendances = new Map<string, SlotAttendance>();
  for (const row of attendanceRows) {
    if (isAttendanceStatus(row.status)) {
      todayAttendances.set(row.slot_id, {
        attendanceId: row.id,
        requiresDeparture: row.requires_departure,
        departedAt: row.departed_at,
        departureSource: row.departure_source,
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

/** Créneaux actifs parmi ceux de l'utilisateur, avec le nom de leur école. */
async function loadSlots(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  slotIds: string[],
): Promise<{ slots: AgendaSlot[] } | { error: string }> {
  if (slotIds.length === 0) return { slots: [] };

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

  return {
    slots: slotsResult.data.map((slot) => ({
      id: slot.id,
      schoolId: slot.school_id,
      schoolName: names.get(slot.school_id) ?? "École",
      weekday: slot.weekday,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      label: slot.label,
    })),
  };
}
