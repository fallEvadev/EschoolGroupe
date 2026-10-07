import type { AttendanceStatus, LocationResult } from "@/lib/attendance";
import {
  dakarIsoDate,
  dakarMinutes,
  isoWeekdayOf,
  monthDays,
} from "@/lib/dates";
import { timeToMinutes } from "@/lib/schools";

/** Créneau hebdomadaire, avec ses dates de création et d'archivage. */
export type SheetSlot = {
  id: string;
  schoolId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  label: string | null;
  createdAt: string;
  /** Date d'archivage (`updated_at` d'un créneau archivé), sinon `null`. */
  archivedAt: string | null;
};

/** Affectation d'un formateur à un créneau. */
export type SheetAssignment = {
  slotId: string;
  profileId: string;
  createdAt: string;
  archivedAt: string | null;
};

/** Pointage enregistré (la preuve brute, jamais modifiée). */
export type SheetAttendance = {
  id: string;
  profileId: string;
  slotId: string;
  schoolId: string;
  /** Jour du pointage, « aaaa-mm-jj ». */
  date: string;
  recordedAt: string;
  status: AttendanceStatus;
  lateMinutes: number;
  locationResult: LocationResult;
  distanceM: number | null;
  accuracyM: number | null;
  /** Position GPS du formateur au pointage (vide si le téléphone n'en a pas donné). */
  latitude: number | null;
  longitude: number | null;
};

/** Décision de la Direction sur un pointage « à vérifier ». */
export type SheetReview = {
  attendanceId: string;
  decision: "valide" | "refuse";
  comment: string | null;
};

/** Absence excusée. */
export type SheetExcuse = {
  id: string;
  profileId: string;
  slotId: string;
  date: string;
  reason: string;
};

/** Jour sans cours : pour toutes les écoles (`schoolId` vide) ou une seule. */
export type SheetClosedDay = {
  id: string;
  date: string;
  schoolId: string | null;
  reason: string;
};

/** État d'une ligne de la feuille. */
export const ROW_STATES = [
  "present",
  "retard",
  "a_verifier",
  "refuse",
  "absent",
  "excuse",
  "en_attente",
  "a_venir",
] as const;

export type RowState = (typeof ROW_STATES)[number];

export const ROW_STATE_LABELS: Record<RowState, string> = {
  present: "Présent",
  retard: "Retard",
  a_verifier: "À vérifier",
  refuse: "Refusé",
  absent: "Absent",
  excuse: "Excusé",
  en_attente: "Pas encore pointé",
  a_venir: "À venir",
};

export const ROW_STATE_BADGE: Record<
  RowState,
  "success" | "warning" | "destructive" | "neutral"
> = {
  present: "success",
  retard: "warning",
  a_verifier: "warning",
  refuse: "destructive",
  absent: "destructive",
  excuse: "neutral",
  en_attente: "neutral",
  a_venir: "neutral",
};

/** Une ligne de la feuille : un formateur sur un créneau, ce jour-là. */
export type SheetRow = {
  key: string;
  date: string;
  profileId: string;
  slotId: string;
  schoolId: string;
  startsAt: string;
  endsAt: string;
  label: string | null;
  state: RowState;
  attendance: SheetAttendance | null;
  review: SheetReview | null;
  excuse: SheetExcuse | null;
};

/** Seul un pointage « à vérifier » peut être validé ou refusé. */
export function canReview(state: RowState): boolean {
  return state === "a_verifier";
}

/** Seule une absence (ou un pointage refusé) peut être excusée. */
export function canExcuse(state: RowState): boolean {
  return state === "absent" || state === "refuse";
}

/**
 * Un créneau ou une affectation était-il en vigueur ce jour-là ? Du jour de sa
 * création jusqu'à la veille de son archivage : le jour de l'archivage lui-même
 * est exclu (un créneau archivé par erreur le jour même ne donne aucune
 * absence). Les créneaux ne sont jamais modifiés, seulement archivés : on peut
 * donc reconstruire exactement ce qui était attendu un jour passé.
 */
export function wasActiveOn(
  date: string,
  createdAt: string,
  archivedAt: string | null,
): boolean {
  if (dakarIsoDate(new Date(createdAt)) > date) return false;
  if (archivedAt !== null && dakarIsoDate(new Date(archivedAt)) <= date) {
    return false;
  }
  return true;
}

/**
 * État d'un pointage après la décision éventuelle de la Direction : validé →
 * retard ou présent selon l'heure d'arrivée ; refusé → « refusé ».
 */
export function effectiveState(
  attendance: Pick<SheetAttendance, "status" | "lateMinutes">,
  review: Pick<SheetReview, "decision"> | null,
): RowState {
  if (review?.decision === "refuse") return "refuse";
  if (review?.decision === "valide") {
    return attendance.lateMinutes > 0 ? "retard" : "present";
  }
  return attendance.status;
}

const keyOf = (profileId: string, slotId: string) => `${profileId}:${slotId}`;

/** Le jour est-il sans cours pour cette école ? */
function isClosed(
  schoolId: string,
  closedDays: readonly SheetClosedDay[],
): boolean {
  return closedDays.some(
    (day) => day.schoolId === null || day.schoolId === schoolId,
  );
}

/**
 * Feuille d'un jour : tout ce qui était attendu (planning reconstruit à cette
 * date) et tout ce qui a été pointé, avec l'état de chaque ligne.
 *
 * - Un pointage est toujours montré, même si le créneau a changé depuis ou si
 *   le jour est « sans cours » : on ne cache jamais une donnée.
 * - Un créneau attendu sans pointage devient « absent » une fois le créneau
 *   terminé (ou si le jour est passé), « pas encore pointé » avant, « à venir »
 *   pour un jour futur. « Excusé » prime sur « absent ».
 * - Un jour sans cours supprime les absences (pas les pointages).
 */
export function buildSheet({
  date,
  now,
  slots,
  assignments,
  attendances,
  reviews,
  excuses,
  closedDays,
}: {
  date: string;
  now: Date;
  slots: readonly SheetSlot[];
  assignments: readonly SheetAssignment[];
  /** Pointages de ce jour seulement. */
  attendances: readonly SheetAttendance[];
  reviews: readonly SheetReview[];
  /** Excuses de ce jour seulement. */
  excuses: readonly SheetExcuse[];
  /** Jours sans cours de cette date seulement. */
  closedDays: readonly SheetClosedDay[];
}): SheetRow[] {
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const reviewsByAttendance = new Map(
    reviews.map((review) => [review.attendanceId, review]),
  );
  const excusesByKey = new Map(
    excuses.map((excuse) => [keyOf(excuse.profileId, excuse.slotId), excuse]),
  );
  const today = dakarIsoDate(now);
  const nowMinutes = dakarMinutes(now);
  const weekday = isoWeekdayOf(date);

  const rows = new Map<string, SheetRow>();

  // 1. Tout ce qui a été pointé ce jour-là.
  for (const attendance of attendances) {
    const slot = slotsById.get(attendance.slotId);
    const key = keyOf(attendance.profileId, attendance.slotId);
    const review = reviewsByAttendance.get(attendance.id) ?? null;
    const excuse = excusesByKey.get(key) ?? null;
    let state = effectiveState(attendance, review);
    if (excuse && state === "refuse") state = "excuse";
    rows.set(key, {
      key,
      date,
      profileId: attendance.profileId,
      slotId: attendance.slotId,
      schoolId: attendance.schoolId,
      startsAt: slot?.startsAt ?? "00:00:00",
      endsAt: slot?.endsAt ?? "00:00:00",
      label: slot?.label ?? null,
      state,
      attendance,
      review,
      excuse,
    });
  }

  // 2. Tout ce qui était attendu et n'a pas été pointé.
  for (const assignment of assignments) {
    const slot = slotsById.get(assignment.slotId);
    if (!slot || slot.weekday !== weekday) continue;
    if (!wasActiveOn(date, assignment.createdAt, assignment.archivedAt))
      continue;
    if (!wasActiveOn(date, slot.createdAt, slot.archivedAt)) continue;

    const key = keyOf(assignment.profileId, assignment.slotId);
    if (rows.has(key)) continue;
    if (isClosed(slot.schoolId, closedDays)) continue;

    const excuse = excusesByKey.get(key) ?? null;
    let state: RowState;
    if (excuse) state = "excuse";
    else if (date > today) state = "a_venir";
    else if (date < today) state = "absent";
    else
      state =
        nowMinutes >= timeToMinutes(slot.endsAt) ? "absent" : "en_attente";

    rows.set(key, {
      key,
      date,
      profileId: assignment.profileId,
      slotId: slot.id,
      schoolId: slot.schoolId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      label: slot.label,
      state,
      attendance: null,
      review: null,
      excuse,
    });
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) || a.key.localeCompare(b.key),
  );
}

/** Compteurs d'une feuille ou d'un mois. */
export type SheetCounts = {
  present: number;
  retard: number;
  aVerifier: number;
  /** Absences et pointages refusés (un refus compte comme une absence). */
  absent: number;
  excuse: number;
  enAttente: number;
};

export function emptyCounts(): SheetCounts {
  return {
    present: 0,
    retard: 0,
    aVerifier: 0,
    absent: 0,
    excuse: 0,
    enAttente: 0,
  };
}

function addState(counts: SheetCounts, state: RowState): void {
  switch (state) {
    case "present":
      counts.present++;
      break;
    case "retard":
      counts.retard++;
      break;
    case "a_verifier":
      counts.aVerifier++;
      break;
    case "absent":
    case "refuse":
      counts.absent++;
      break;
    case "excuse":
      counts.excuse++;
      break;
    case "en_attente":
      counts.enAttente++;
      break;
    case "a_venir":
      break;
  }
}

export function countRows(rows: readonly { state: RowState }[]): SheetCounts {
  const counts = emptyCounts();
  for (const row of rows) addState(counts, row.state);
  return counts;
}

/**
 * Synthèse d'un mois par formateur : on reconstruit la feuille de chaque jour
 * écoulé (les jours futurs sont ignorés) et on additionne.
 */
export function monthSummary({
  month,
  now,
  slots,
  assignments,
  attendances,
  reviews,
  excuses,
  closedDays,
}: {
  month: string;
  now: Date;
  slots: readonly SheetSlot[];
  assignments: readonly SheetAssignment[];
  attendances: readonly SheetAttendance[];
  reviews: readonly SheetReview[];
  excuses: readonly SheetExcuse[];
  closedDays: readonly SheetClosedDay[];
}): Map<string, SheetCounts> {
  const today = dakarIsoDate(now);
  const summary = new Map<string, SheetCounts>();

  for (const date of monthDays(month)) {
    if (date > today) break;
    const rows = buildSheet({
      date,
      now,
      slots,
      assignments,
      attendances: attendances.filter((a) => a.date === date),
      reviews,
      excuses: excuses.filter((e) => e.date === date),
      closedDays: closedDays.filter((d) => d.date === date),
    });
    for (const row of rows) {
      let counts = summary.get(row.profileId);
      if (!counts) {
        counts = emptyCounts();
        summary.set(row.profileId, counts);
      }
      addState(counts, row.state);
    }
  }
  return summary;
}
