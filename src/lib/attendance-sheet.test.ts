import { describe, expect, it } from "vitest";

import {
  buildSheet,
  canExcuse,
  canReview,
  countRows,
  effectiveState,
  monthSummary,
  wasActiveOn,
  type SheetAssignment,
  type SheetAttendance,
  type SheetClosedDay,
  type SheetExcuse,
  type SheetReview,
  type SheetSlot,
} from "./attendance-sheet";

/** Mercredi 7 octobre 2026 (jour de la semaine 3). */
const WEDNESDAY = "2026-10-07";

const slot = (overrides: Partial<SheetSlot> = {}): SheetSlot => ({
  id: "slot-1",
  schoolId: "school-1",
  weekday: 3,
  startsAt: "08:00:00",
  endsAt: "10:00:00",
  label: null,
  createdAt: "2026-09-01T08:00:00Z",
  archivedAt: null,
  ...overrides,
});

const assignment = (
  overrides: Partial<SheetAssignment> = {},
): SheetAssignment => ({
  slotId: "slot-1",
  profileId: "p1",
  createdAt: "2026-09-01T08:00:00Z",
  archivedAt: null,
  ...overrides,
});

const attendance = (
  overrides: Partial<SheetAttendance> = {},
): SheetAttendance => ({
  id: "att-1",
  profileId: "p1",
  slotId: "slot-1",
  schoolId: "school-1",
  date: WEDNESDAY,
  recordedAt: "2026-10-07T08:05:00Z",
  status: "present",
  lateMinutes: 0,
  locationResult: "ok",
  distanceM: 30,
  accuracyM: 12,
  latitude: 14.6928,
  longitude: -17.4467,
  ...overrides,
});

const base = {
  slots: [slot()],
  assignments: [assignment()],
  attendances: [] as SheetAttendance[],
  reviews: [] as SheetReview[],
  excuses: [] as SheetExcuse[],
  closedDays: [] as SheetClosedDay[],
};

const at = (iso: string) => new Date(iso);

describe("wasActiveOn", () => {
  it("est actif du jour de sa création jusqu'à la veille de son archivage", () => {
    expect(wasActiveOn("2026-10-07", "2026-10-07T07:00:00Z", null)).toBe(true);
    expect(wasActiveOn("2026-10-06", "2026-10-07T07:00:00Z", null)).toBe(false);
    expect(
      wasActiveOn("2026-10-07", "2026-09-01T08:00:00Z", "2026-10-08T09:00:00Z"),
    ).toBe(true);
  });

  it("exclut le jour de l'archivage lui-même", () => {
    expect(
      wasActiveOn("2026-10-07", "2026-09-01T08:00:00Z", "2026-10-07T09:00:00Z"),
    ).toBe(false);
    expect(
      wasActiveOn("2026-10-08", "2026-09-01T08:00:00Z", "2026-10-07T09:00:00Z"),
    ).toBe(false);
  });

  it("n'attend rien d'un élément créé et archivé le même jour", () => {
    expect(
      wasActiveOn("2026-10-07", "2026-10-07T07:00:00Z", "2026-10-07T07:30:00Z"),
    ).toBe(false);
  });
});

describe("effectiveState", () => {
  it("garde le statut d'origine sans décision", () => {
    expect(effectiveState({ status: "retard", lateMinutes: 20 }, null)).toBe(
      "retard",
    );
    expect(effectiveState({ status: "a_verifier", lateMinutes: 0 }, null)).toBe(
      "a_verifier",
    );
  });

  it("une validation donne retard ou présent selon l'heure d'arrivée", () => {
    const valide = { decision: "valide" as const };
    expect(
      effectiveState({ status: "a_verifier", lateMinutes: 0 }, valide),
    ).toBe("present");
    expect(
      effectiveState({ status: "a_verifier", lateMinutes: 25 }, valide),
    ).toBe("retard");
  });

  it("un refus donne « refusé »", () => {
    expect(
      effectiveState(
        { status: "a_verifier", lateMinutes: 0 },
        { decision: "refuse" },
      ),
    ).toBe("refuse");
  });
});

describe("canReview et canExcuse", () => {
  it("seul un pointage à vérifier se traite", () => {
    expect(canReview("a_verifier")).toBe(true);
    expect(canReview("present")).toBe(false);
    expect(canReview("absent")).toBe(false);
  });

  it("seule une absence ou un refus s'excuse", () => {
    expect(canExcuse("absent")).toBe(true);
    expect(canExcuse("refuse")).toBe(true);
    expect(canExcuse("present")).toBe(false);
    expect(canExcuse("excuse")).toBe(false);
    expect(canExcuse("en_attente")).toBe(false);
  });
});

describe("buildSheet : créneaux attendus sans pointage", () => {
  it("est « pas encore pointé » avant la fin du créneau, aujourd'hui", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now: at("2026-10-07T09:00:00Z"),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("en_attente");
  });

  it("devient « absent » à la fin du créneau, aujourd'hui", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now: at("2026-10-07T10:00:00Z"),
    });
    expect(rows[0]?.state).toBe("absent");
  });

  it("est « absent » pour un jour passé", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now: at("2026-10-09T12:00:00Z"),
    });
    expect(rows[0]?.state).toBe("absent");
  });

  it("est « à venir » pour un jour futur", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now: at("2026-10-05T12:00:00Z"),
    });
    expect(rows[0]?.state).toBe("a_venir");
  });

  it("n'attend personne un autre jour de la semaine", () => {
    const rows = buildSheet({
      ...base,
      date: "2026-10-08", // jeudi
      now: at("2026-10-09T12:00:00Z"),
    });
    expect(rows).toEqual([]);
  });
});

describe("buildSheet : reconstruction du planning à la date", () => {
  const now = at("2026-10-20T12:00:00Z");

  it("attend toujours un créneau archivé plus tard", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      slots: [slot({ archivedAt: "2026-10-15T09:00:00Z" })],
    });
    expect(rows[0]?.state).toBe("absent");
  });

  it("n'attend plus un créneau archivé ce jour-là ou avant", () => {
    for (const archivedAt of ["2026-10-07T09:00:00Z", "2026-10-01T09:00:00Z"]) {
      expect(
        buildSheet({
          ...base,
          date: WEDNESDAY,
          now,
          slots: [slot({ archivedAt })],
        }),
      ).toEqual([]);
    }
  });

  it("n'attend pas un créneau créé après cette date", () => {
    expect(
      buildSheet({
        ...base,
        date: WEDNESDAY,
        now,
        slots: [slot({ createdAt: "2026-10-10T08:00:00Z" })],
      }),
    ).toEqual([]);
  });

  it("n'attend pas un formateur affecté après cette date ou retiré avant", () => {
    expect(
      buildSheet({
        ...base,
        date: WEDNESDAY,
        now,
        assignments: [assignment({ createdAt: "2026-10-10T08:00:00Z" })],
      }),
    ).toEqual([]);
    expect(
      buildSheet({
        ...base,
        date: WEDNESDAY,
        now,
        assignments: [assignment({ archivedAt: "2026-10-03T08:00:00Z" })],
      }),
    ).toEqual([]);
  });

  it("attend chaque formateur affecté, une ligne par formateur", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      assignments: [
        assignment({ profileId: "p1" }),
        assignment({ profileId: "p2" }),
      ],
    });
    expect(rows.map((row) => row.profileId).sort()).toEqual(["p1", "p2"]);
  });
});

describe("buildSheet : pointages", () => {
  const now = at("2026-10-07T12:00:00Z");

  it("montre le statut d'origine d'un pointage", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      attendances: [attendance({ status: "retard", lateMinutes: 22 })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("retard");
    expect(rows[0]?.attendance?.lateMinutes).toBe(22);
  });

  it("ne duplique pas un formateur attendu qui a pointé", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      attendances: [attendance()],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("present");
  });

  it("montre un pointage même si le créneau est archivé depuis", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      slots: [slot({ archivedAt: "2026-10-07T09:00:00Z" })],
      assignments: [],
      attendances: [attendance()],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("present");
  });

  it("applique la décision de la Direction", () => {
    const pending = attendance({
      status: "a_verifier",
      locationResult: "hors_rayon",
      distanceM: 850,
    });
    const state = (review?: SheetReview) =>
      buildSheet({
        ...base,
        date: WEDNESDAY,
        now,
        attendances: [pending],
        reviews: review ? [review] : [],
      })[0]?.state;

    expect(state()).toBe("a_verifier");
    expect(
      state({ attendanceId: "att-1", decision: "valide", comment: null }),
    ).toBe("present");
    expect(
      state({ attendanceId: "att-1", decision: "refuse", comment: "Absent" }),
    ).toBe("refuse");
  });

  it("une validation d'un pointage en retard donne « retard »", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      attendances: [attendance({ status: "a_verifier", lateMinutes: 30 })],
      reviews: [{ attendanceId: "att-1", decision: "valide", comment: null }],
    });
    expect(rows[0]?.state).toBe("retard");
  });
});

describe("buildSheet : excuses", () => {
  const now = at("2026-10-09T12:00:00Z");
  const excuse: SheetExcuse = {
    id: "ex-1",
    profileId: "p1",
    slotId: "slot-1",
    date: WEDNESDAY,
    reason: "Malade",
  };

  it("une excuse remplace « absent »", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      excuses: [excuse],
    });
    expect(rows[0]?.state).toBe("excuse");
    expect(rows[0]?.excuse?.reason).toBe("Malade");
  });

  it("une excuse remplace aussi « refusé »", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      attendances: [attendance({ status: "a_verifier" })],
      reviews: [
        { attendanceId: "att-1", decision: "refuse", comment: "Absent" },
      ],
      excuses: [excuse],
    });
    expect(rows[0]?.state).toBe("excuse");
  });

  it("une excuse d'un autre formateur ne change rien", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      excuses: [{ ...excuse, profileId: "p2" }],
    });
    expect(rows[0]?.state).toBe("absent");
  });
});

describe("buildSheet : jours sans cours", () => {
  const now = at("2026-10-09T12:00:00Z");
  const allSchools: SheetClosedDay = {
    id: "c1",
    date: WEDNESDAY,
    schoolId: null,
    reason: "Tabaski",
  };

  it("supprime les absences d'un jour sans cours pour toutes les écoles", () => {
    expect(
      buildSheet({ ...base, date: WEDNESDAY, now, closedDays: [allSchools] }),
    ).toEqual([]);
  });

  it("supprime les absences d'une seule école", () => {
    const closed = { ...allSchools, schoolId: "school-1" };
    expect(
      buildSheet({ ...base, date: WEDNESDAY, now, closedDays: [closed] }),
    ).toEqual([]);

    const other = { ...allSchools, schoolId: "autre-ecole" };
    expect(
      buildSheet({ ...base, date: WEDNESDAY, now, closedDays: [other] })[0]
        ?.state,
    ).toBe("absent");
  });

  it("montre quand même un pointage fait un jour sans cours", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now,
      closedDays: [allSchools],
      attendances: [attendance()],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("present");
  });
});

describe("buildSheet : ordre", () => {
  it("trie les lignes par heure de début", () => {
    const rows = buildSheet({
      ...base,
      date: WEDNESDAY,
      now: at("2026-10-09T12:00:00Z"),
      slots: [
        slot({ id: "tard", startsAt: "14:00:00", endsAt: "16:00:00" }),
        slot({ id: "tot", startsAt: "07:00:00", endsAt: "08:00:00" }),
      ],
      assignments: [
        assignment({ slotId: "tard" }),
        assignment({ slotId: "tot" }),
      ],
    });
    expect(rows.map((row) => row.slotId)).toEqual(["tot", "tard"]);
  });
});

describe("countRows", () => {
  it("compte un refus comme une absence et ignore « à venir »", () => {
    const counts = countRows([
      { state: "present" },
      { state: "present" },
      { state: "retard" },
      { state: "a_verifier" },
      { state: "absent" },
      { state: "refuse" },
      { state: "excuse" },
      { state: "en_attente" },
      { state: "a_venir" },
    ]);
    expect(counts).toEqual({
      present: 2,
      retard: 1,
      aVerifier: 1,
      absent: 2,
      excuse: 1,
      enAttente: 1,
    });
  });

  it("renvoie des zéros pour une feuille vide", () => {
    expect(countRows([])).toEqual({
      present: 0,
      retard: 0,
      aVerifier: 0,
      absent: 0,
      excuse: 0,
      enAttente: 0,
    });
  });
});

describe("monthSummary (octobre 2026, mercredis 7 et 14)", () => {
  const now = at("2026-10-15T12:00:00Z");

  const summary = monthSummary({
    month: "2026-10",
    now,
    slots: [slot()],
    assignments: [
      assignment({ profileId: "p1" }),
      assignment({ profileId: "p2" }),
    ],
    attendances: [
      attendance({ id: "a1", profileId: "p1" }),
      attendance({
        id: "a2",
        profileId: "p2",
        status: "a_verifier",
        locationResult: "hors_rayon",
      }),
    ],
    reviews: [{ attendanceId: "a2", decision: "refuse", comment: "Absent" }],
    excuses: [
      {
        id: "e1",
        profileId: "p2",
        slotId: "slot-1",
        date: "2026-10-14",
        reason: "Malade",
      },
    ],
    closedDays: [],
  });

  it("additionne les jours écoulés par formateur", () => {
    // p1 : présent le 7, absent le 14.
    expect(summary.get("p1")).toEqual({
      present: 1,
      retard: 0,
      aVerifier: 0,
      absent: 1,
      excuse: 0,
      enAttente: 0,
    });
    // p2 : refusé le 7 (compte comme absence), excusé le 14.
    expect(summary.get("p2")).toEqual({
      present: 0,
      retard: 0,
      aVerifier: 0,
      absent: 1,
      excuse: 1,
      enAttente: 0,
    });
  });

  it("ignore les jours à venir", () => {
    const early = monthSummary({
      month: "2026-10",
      now: at("2026-10-08T12:00:00Z"),
      slots: [slot()],
      assignments: [assignment()],
      attendances: [],
      reviews: [],
      excuses: [],
      closedDays: [],
    });
    // Seul le mercredi 7 est écoulé.
    expect(early.get("p1")?.absent).toBe(1);
  });

  it("n'a aucune ligne pour un mois entièrement dans le futur", () => {
    const future = monthSummary({
      month: "2026-12",
      now,
      slots: [slot()],
      assignments: [assignment()],
      attendances: [],
      reviews: [],
      excuses: [],
      closedDays: [],
    });
    expect(future.size).toBe(0);
  });
});
