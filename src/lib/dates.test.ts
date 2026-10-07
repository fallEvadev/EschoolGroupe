import { describe, expect, it } from "vitest";

import {
  dakarIsoDate,
  dakarIsoWeekday,
  dakarMinutes,
  formatClock,
  formatDate,
  formatDateTime,
  formatLongDate,
} from "./dates";

describe("dakarMinutes", () => {
  it("compte les minutes depuis minuit à l'heure de Dakar", () => {
    expect(dakarMinutes(new Date("2026-10-07T00:00:00Z"))).toBe(0);
    expect(dakarMinutes(new Date("2026-10-07T08:30:00Z"))).toBe(510);
    expect(dakarMinutes(new Date("2026-10-07T23:59:00Z"))).toBe(1439);
  });

  it("convertit d'abord l'heure dans le fuseau de Dakar", () => {
    // 10:00 à Paris (UTC+2 en été) = 08:00 à Dakar.
    expect(dakarMinutes(new Date("2026-07-01T10:00:00+02:00"))).toBe(480);
  });
});

describe("dakarIsoWeekday", () => {
  it("renvoie 1 pour lundi et 7 pour dimanche", () => {
    expect(dakarIsoWeekday(new Date("2026-10-05T12:00:00Z"))).toBe(1);
    expect(dakarIsoWeekday(new Date("2026-10-11T12:00:00Z"))).toBe(7);
  });

  it("utilise le jour de Dakar, pas celui du serveur", () => {
    // Mardi 01:15 à Paris = lundi 23:15 à Dakar.
    expect(dakarIsoWeekday(new Date("2026-07-07T01:15:00+02:00"))).toBe(1);
  });
});

describe("formatClock", () => {
  it("affiche l'heure seule à Dakar", () => {
    expect(formatClock("2026-10-07T14:05:00Z")).toBe("14:05");
  });
});

describe("dakarIsoDate", () => {
  it("renvoie le jour à Dakar au format aaaa-mm-jj", () => {
    expect(dakarIsoDate(new Date("2026-10-07T09:30:00Z"))).toBe("2026-10-07");
  });

  it("garde le jour de Dakar même quand il est déjà le lendemain ailleurs", () => {
    // 01:15 à Paris le 1er juillet = 23:15 le 30 juin à Dakar.
    expect(dakarIsoDate(new Date("2026-07-01T01:15:00+02:00"))).toBe(
      "2026-06-30",
    );
  });
});

describe("formatDateTime", () => {
  it("affiche jj/mm/aaaa hh:mm à l'heure de Dakar (UTC+0)", () => {
    expect(formatDateTime("2026-10-05T14:32:00Z")).toBe("05/10/2026 14:32");
  });

  it("convertit une heure d'un autre fuseau", () => {
    // 01:15 à Paris (UTC+2 en été) = 23:15 la veille à Dakar.
    expect(formatDateTime("2026-07-01T01:15:00+02:00")).toBe(
      "30/06/2026 23:15",
    );
  });
});

describe("formatLongDate", () => {
  it("écrit la date en toutes lettres, en français", () => {
    expect(formatLongDate("2026-10-05T12:00:00Z")).toBe("lundi 5 octobre");
  });
});

describe("formatDate", () => {
  it("affiche une date seule au format jj/mm/aaaa", () => {
    expect(formatDate("2026-09-01")).toBe("01/09/2026");
  });
});
