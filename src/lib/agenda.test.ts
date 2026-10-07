import { describe, expect, it } from "vitest";

import { groupByWeekday, slotAvailability, slotsForWeekday } from "./agenda";

const slot = (
  id: string,
  weekday: number,
  startsAt: string,
  endsAt: string,
) => ({
  id,
  schoolId: "s1",
  schoolName: "Campus Dakar",
  weekday,
  startsAt,
  endsAt,
  label: null,
});

const slots = [
  slot("c", 3, "14:00:00", "16:00:00"),
  slot("a", 1, "08:00:00", "10:00:00"),
  slot("b", 1, "07:00:00", "07:45:00"),
  slot("d", 3, "08:00:00", "09:00:00"),
];

describe("slotsForWeekday", () => {
  it("garde les créneaux du jour dans l'ordre des heures", () => {
    expect(slotsForWeekday(slots, 1).map((s) => s.id)).toEqual(["b", "a"]);
    expect(slotsForWeekday(slots, 3).map((s) => s.id)).toEqual(["d", "c"]);
  });

  it("renvoie une liste vide pour un jour sans créneau", () => {
    expect(slotsForWeekday(slots, 5)).toEqual([]);
  });
});

describe("groupByWeekday", () => {
  it("groupe par jour, du lundi au dimanche, sans les jours vides", () => {
    const groups = groupByWeekday(slots);
    expect(groups.map((g) => g.weekday)).toEqual([1, 3]);
    expect(groups[0]?.slots.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("renvoie une liste vide sans créneau", () => {
    expect(groupByWeekday([])).toEqual([]);
  });
});

describe("slotAvailability (créneau 08:00–10:00)", () => {
  const target = { startsAt: "08:00:00", endsAt: "10:00:00" };
  const at = (hours: number, minutes: number) => hours * 60 + minutes;

  it("est « à venir » avant l'ouverture, avec l'heure d'ouverture", () => {
    expect(slotAvailability({ slot: target, nowMinutes: at(7, 0) })).toEqual({
      kind: "upcoming",
      opensAtMinutes: 450,
    });
  });

  it("est ouvert de 07:30 jusqu'à la fin du créneau", () => {
    expect(slotAvailability({ slot: target, nowMinutes: at(7, 30) })).toEqual({
      kind: "open",
    });
    expect(slotAvailability({ slot: target, nowMinutes: at(9, 59) })).toEqual({
      kind: "open",
    });
  });

  it("est « manqué » une fois le créneau terminé sans pointage", () => {
    expect(slotAvailability({ slot: target, nowMinutes: at(10, 0) })).toEqual({
      kind: "missed",
    });
  });

  it("montre le pointage déjà enregistré, quelle que soit l'heure", () => {
    const attendance = {
      status: "retard" as const,
      recordedAt: "2026-10-07T08:20:00Z",
    };
    expect(
      slotAvailability({ slot: target, nowMinutes: at(15, 0), attendance }),
    ).toEqual({ kind: "pointed", ...attendance });
  });
});
