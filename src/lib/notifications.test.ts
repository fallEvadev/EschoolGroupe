import { describe, expect, it } from "vitest";

import {
  badgeLabel,
  bellLabel,
  hasNewNotification,
  NOTIFIED_ROLES,
  safeInternalLink,
} from "./notifications";

describe("badgeLabel", () => {
  it.each([
    [0, null],
    [-3, null],
    [Number.NaN, null],
    [1, "1"],
    [9, "9"],
    [10, "9+"],
    [250, "9+"],
  ])("%s -> %s", (count, expected) => {
    expect(badgeLabel(count)).toBe(expected);
  });
});

describe("NOTIFIED_ROLES", () => {
  it("couvre le formateur et la Direction pédagogique seulement", () => {
    expect([...NOTIFIED_ROLES].sort()).toEqual(
      ["admin_pedagogie", "formateur", "super_admin"].sort(),
    );
    expect(NOTIFIED_ROLES).not.toContain("admin_rh");
    expect(NOTIFIED_ROLES).not.toContain("directeur_partenaire");
  });
});

describe("hasNewNotification", () => {
  it("détecte une hausse seulement", () => {
    expect(hasNewNotification(0, 1)).toBe(true);
    expect(hasNewNotification(2, 2)).toBe(false);
    expect(hasNewNotification(3, 1)).toBe(false);
  });
});

describe("bellLabel", () => {
  it("décrit le nombre de non lues", () => {
    expect(bellLabel(0)).toBe("Notifications");
    expect(bellLabel(1)).toBe("Notifications : 1 non lue");
    expect(bellLabel(4)).toBe("Notifications : 4 non lues");
  });
});

describe("safeInternalLink", () => {
  it("accepte un chemin interne", () => {
    expect(safeInternalLink("/formateur/cahiers/abc-123")).toBe(
      "/formateur/cahiers/abc-123",
    );
  });

  it.each([
    null,
    "",
    "https://exemple.com",
    "//exemple.com",
    "javascript:alert(1)",
    "/a?b=1",
    "formateur/cahiers",
  ])("refuse %s", (link) => {
    expect(safeInternalLink(link)).toBeNull();
  });
});
