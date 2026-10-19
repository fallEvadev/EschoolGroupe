import { describe, expect, it } from "vitest";

import {
  departureMessage,
  departureStage,
  formatDuration,
  reportIsOpen,
} from "./departure";

const base = {
  requiresDeparture: true,
  departedAt: null,
  departureSource: null,
  endsAt: "12:00:00",
  isToday: true,
};
const minutes = (h: number, m = 0) => h * 60 + m;

describe("departureStage", () => {
  it("un ancien pointage n'a ni descente ni fenêtre de rapport", () => {
    const stage = departureStage({
      ...base,
      requiresDeparture: false,
      nowMinutes: minutes(9),
    });
    expect(stage).toEqual({ stage: "legacy" });
    expect(reportIsOpen(stage)).toBe(true);
  });

  it("le rapport est fermé jusqu'à 10 minutes avant la fin", () => {
    const stage = departureStage({ ...base, nowMinutes: minutes(11, 49) });
    expect(stage).toEqual({ stage: "closed", opensAtMinutes: minutes(11, 50) });
    expect(reportIsOpen(stage)).toBe(false);
    expect(departureMessage(stage)).toContain("11:50");
  });

  it("le rapport s'ouvre à fin - 10 min, inclus", () => {
    const stage = departureStage({ ...base, nowMinutes: minutes(11, 50) });
    expect(stage).toEqual({ stage: "report_open", endsAtMinutes: minutes(12) });
    expect(reportIsOpen(stage)).toBe(true);
  });

  it("à la fin du cours, le code est attendu", () => {
    const stage = departureStage({ ...base, nowMinutes: minutes(12) });
    expect(stage).toEqual({ stage: "awaiting_code" });
  });

  it("descente validée par le code : le rapport peut partir", () => {
    const stage = departureStage({
      ...base,
      departedAt: "2026-10-19T12:04:00Z",
      departureSource: "code",
      nowMinutes: minutes(12, 5),
    });
    expect(stage).toEqual({ stage: "done", source: "code" });
  });

  it("descente validée par la Direction : le dit clairement", () => {
    const stage = departureStage({
      ...base,
      departedAt: "2026-10-19T12:00:00Z",
      departureSource: "direction",
      nowMinutes: minutes(18),
    });
    expect(stage).toEqual({ stage: "done", source: "direction" });
    expect(departureMessage(stage)).toContain("Direction");
  });

  it("un jour passé sans descente : plus de code possible, c'est à la Direction d'agir", () => {
    const stage = departureStage({
      ...base,
      isToday: false,
      nowMinutes: minutes(9),
    });
    expect(stage).toEqual({ stage: "expired" });
    expect(reportIsOpen(stage)).toBe(true);
  });

  it("un cours qui finit juste après minuit ne fait pas « le tour » de l'horloge", () => {
    const stage = departureStage({
      ...base,
      endsAt: "00:05:00",
      nowMinutes: 2,
    });
    // fin - 10 min = -5 : le rapport est ouvert dès minuit (et jamais « fermé »)
    expect(stage).toEqual({ stage: "report_open", endsAtMinutes: 5 });
  });
});

describe("formatDuration", () => {
  it("affiche heures et minutes", () => {
    expect(formatDuration("2026-10-19T08:05:00Z", "2026-10-19T12:00:00Z")).toBe(
      "3 h 55",
    );
    expect(formatDuration("2026-10-19T08:00:00Z", "2026-10-19T09:07:00Z")).toBe(
      "1 h 07",
    );
  });
  it("affiche seulement les minutes sous une heure", () => {
    expect(formatDuration("2026-10-19T08:00:00Z", "2026-10-19T08:40:00Z")).toBe(
      "40 min",
    );
  });
  it("refuse un ordre incohérent ou une date invalide", () => {
    expect(
      formatDuration("2026-10-19T12:00:00Z", "2026-10-19T08:00:00Z"),
    ).toBeNull();
    expect(formatDuration("n'importe quoi", "2026-10-19T08:00:00Z")).toBeNull();
  });
});
