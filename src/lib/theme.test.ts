import { describe, expect, it } from "vitest";

import { isDark, nextThemeChoice, parseThemeChoice } from "./theme";

describe("parseThemeChoice", () => {
  it("garde clair et sombre, le reste suit l'appareil", () => {
    expect(parseThemeChoice("clair")).toBe("clair");
    expect(parseThemeChoice("sombre")).toBe("sombre");
    expect(parseThemeChoice("auto")).toBe("auto");
    expect(parseThemeChoice(null)).toBe("auto");
    expect(parseThemeChoice("bleu")).toBe("auto");
  });
});

describe("nextThemeChoice", () => {
  it("passe d'automatique à clair, puis sombre, puis revient", () => {
    expect(nextThemeChoice("auto")).toBe("clair");
    expect(nextThemeChoice("clair")).toBe("sombre");
    expect(nextThemeChoice("sombre")).toBe("auto");
  });
});

describe("isDark", () => {
  it("le choix de la personne passe avant l'appareil", () => {
    expect(isDark("clair", true)).toBe(false);
    expect(isDark("sombre", false)).toBe(true);
  });
  it("en automatique, suit l'appareil", () => {
    expect(isDark("auto", true)).toBe(true);
    expect(isDark("auto", false)).toBe(false);
  });
});
