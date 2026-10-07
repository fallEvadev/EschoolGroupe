import { describe, expect, it } from "vitest";

import {
  dakarIsoDate,
  dakarIsoWeekday,
  dakarMinutes,
  formatClock,
  formatDate,
  formatDateTime,
  formatIsoLongDate,
  formatLongDate,
  formatMonthLabel,
  isIsoDate,
  isIsoMonth,
  isoWeekdayOf,
  monthDays,
  monthOf,
  shiftIsoDate,
  shiftMonth,
} from "./dates";

describe("isIsoDate et isIsoMonth", () => {
  it("accepte les vraies dates et refuse les autres", () => {
    expect(isIsoDate("2026-10-07")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("07/10/2026")).toBe(false);
    expect(isIsoDate("2026-10-7")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("accepte un mois valide", () => {
    expect(isIsoMonth("2026-10")).toBe(true);
    expect(isIsoMonth("2026-00")).toBe(false);
    expect(isIsoMonth("2026-13")).toBe(false);
    expect(isIsoMonth("2026-1")).toBe(false);
  });
});

describe("shiftIsoDate", () => {
  it("avance et recule d'un nombre de jours", () => {
    expect(shiftIsoDate("2026-10-07", 1)).toBe("2026-10-08");
    expect(shiftIsoDate("2026-10-07", -7)).toBe("2026-09-30");
  });

  it("passe d'un mois ou d'une année à l'autre", () => {
    expect(shiftIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftIsoDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftIsoDate("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("isoWeekdayOf", () => {
  it("renvoie 1 pour lundi et 7 pour dimanche", () => {
    expect(isoWeekdayOf("2026-10-05")).toBe(1);
    expect(isoWeekdayOf("2026-10-07")).toBe(3);
    expect(isoWeekdayOf("2026-10-11")).toBe(7);
  });
});

describe("mois", () => {
  it("monthOf extrait le mois d'une date", () => {
    expect(monthOf("2026-10-07")).toBe("2026-10");
  });

  it("shiftMonth change de mois, y compris d'année", () => {
    expect(shiftMonth("2026-10", 1)).toBe("2026-11");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("monthDays liste tous les jours du mois", () => {
    const october = monthDays("2026-10");
    expect(october).toHaveLength(31);
    expect(october[0]).toBe("2026-10-01");
    expect(october.at(-1)).toBe("2026-10-31");
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(monthDays("2024-02")).toHaveLength(29);
  });
});

describe("formatIsoLongDate et formatMonthLabel", () => {
  it("écrit le jour et le mois en français", () => {
    expect(formatIsoLongDate("2026-10-05")).toBe("lundi 5 octobre");
    expect(formatMonthLabel("2026-10")).toBe("octobre 2026");
  });
});

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
