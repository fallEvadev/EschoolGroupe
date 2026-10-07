import { evaluateTiming, type AttendanceStatus } from "@/lib/attendance";
import { isWeekday, type Weekday } from "@/lib/schools";

/** Un créneau du planning d'un formateur, avec le nom de l'école. */
export type AgendaSlot = {
  id: string;
  schoolId: string;
  schoolName: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  label: string | null;
};

/** Créneaux d'un jour de la semaine, dans l'ordre des heures. */
export function slotsForWeekday(
  slots: readonly AgendaSlot[],
  weekday: number,
): AgendaSlot[] {
  return slots
    .filter((slot) => slot.weekday === weekday)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Planning de la semaine : seulement les jours qui ont des créneaux. */
export function groupByWeekday(
  slots: readonly AgendaSlot[],
): { weekday: Weekday; slots: AgendaSlot[] }[] {
  return ([1, 2, 3, 4, 5, 6, 7] as const)
    .map((weekday) => ({ weekday, slots: slotsForWeekday(slots, weekday) }))
    .filter((group) => group.slots.length > 0 && isWeekday(group.weekday));
}

/** Pointage déjà enregistré pour un créneau aujourd'hui. */
export type SlotAttendance = {
  status: AttendanceStatus;
  recordedAt: string;
};

/** Ce que le formateur peut faire d'un créneau d'aujourd'hui, à cette heure. */
export type SlotAvailability =
  | ({ kind: "pointed" } & SlotAttendance)
  | { kind: "open" }
  | { kind: "upcoming"; opensAtMinutes: number }
  | { kind: "missed" };

export function slotAvailability({
  slot,
  nowMinutes,
  attendance,
}: {
  slot: Pick<AgendaSlot, "startsAt" | "endsAt">;
  nowMinutes: number;
  attendance?: SlotAttendance;
}): SlotAvailability {
  if (attendance) return { kind: "pointed", ...attendance };
  const timing = evaluateTiming({
    nowMinutes,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    // La tolérance de retard n'intervient pas dans l'ouverture du pointage.
    toleranceMinutes: 0,
  });
  if (timing.state === "open") return { kind: "open" };
  if (timing.state === "too_early") {
    return { kind: "upcoming", opensAtMinutes: timing.opensAtMinutes };
  }
  return { kind: "missed" };
}
