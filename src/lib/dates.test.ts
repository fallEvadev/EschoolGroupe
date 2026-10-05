import { describe, expect, it } from "vitest";

import { formatDateTime, formatLongDate } from "./dates";

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
