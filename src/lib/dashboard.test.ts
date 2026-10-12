import { describe, expect, it } from "vitest";

import {
  activeStaffByRole,
  ATTENDANCE_SERIES,
  axisTicks,
  buildSeries,
  countWithStatus,
  lastDays,
  lastWeeks,
  mondayOf,
  niceMax,
  REPORT_SERIES,
  seriesTotal,
  shortDate,
} from "@/lib/dashboard";

describe("repères de temps", () => {
  it("donne les derniers jours, aujourd'hui en dernier", () => {
    expect(lastDays("2026-10-12", 3)).toEqual([
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
    expect(lastDays("2026-10-02", 4)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("donne les lundis des dernières semaines, la semaine en cours en dernier", () => {
    // 2026-10-14 est un mercredi : la semaine en cours commence le lundi 12/10.
    expect(mondayOf("2026-10-14")).toBe("2026-10-12");
    expect(lastWeeks("2026-10-14", 3)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
    ]);
    expect(lastWeeks("2026-10-12", 1)).toEqual(["2026-10-12"]);
  });

  it("écrit une étiquette courte jour/mois", () => {
    expect(shortDate("2026-10-05")).toBe("05/10");
  });
});

describe("buildSeries", () => {
  const days = ["2026-10-05", "2026-10-06", "2026-10-07"];

  it("répartit les totaux par jour et par série, avec des zéros pour les jours vides", () => {
    const values = buildSeries(
      days,
      [
        { bucket: "2026-10-05", status: "present", count: 4 },
        { bucket: "2026-10-05", status: "retard", count: 1 },
        { bucket: "2026-10-07", status: "a_verifier", count: 2 },
      ],
      ATTENDANCE_SERIES,
    );
    expect(values).toEqual([
      [4, 1, 0],
      [0, 0, 0],
      [0, 0, 2],
    ]);
  });

  it("regroupe plusieurs statuts dans une même série", () => {
    const values = buildSeries(
      ["2026-10-05"],
      [
        { bucket: "2026-10-05", status: "valide", count: 3 },
        { bucket: "2026-10-05", status: "valide_avec_corrections", count: 2 },
        { bucket: "2026-10-05", status: "soumis", count: 1 },
      ],
      REPORT_SERIES,
    );
    expect(values).toEqual([[5, 1, 0]]);
  });

  it("ignore un statut inconnu et un repère hors période", () => {
    const values = buildSeries(
      days,
      [
        { bucket: "2026-10-05", status: "inconnu", count: 9 },
        { bucket: "2025-01-01", status: "present", count: 9 },
      ],
      ATTENDANCE_SERIES,
    );
    expect(values.flat().every((n) => n === 0)).toBe(true);
  });

  it("additionne une colonne", () => {
    expect(
      seriesTotal(
        [
          [4, 1],
          [3, 2],
        ],
        0,
      ),
    ).toBe(7);
    expect(seriesTotal([], 0)).toBe(0);
  });
});

describe("axe vertical", () => {
  it.each([
    [0, 1],
    [1, 1],
    [3, 5],
    [7, 10],
    [12, 20],
    [23, 50],
    [101, 200],
    [Number.NaN, 1],
  ])("niceMax(%s) = %s", (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });

  it("propose 0, la moitié et le maximum quand la moitié est entière", () => {
    expect(axisTicks(10)).toEqual([0, 5, 10]);
    expect(axisTicks(1)).toEqual([0, 1]);
    expect(axisTicks(5)).toEqual([0, 5]);
  });
});

describe("personnel", () => {
  const rows = [
    { role: "formateur", status: "actif", count: 12 },
    { role: "formateur", status: "invite", count: 2 },
    { role: "maintenancier", status: "actif", count: 3 },
    { role: "directeur_partenaire", status: "actif", count: 5 },
    { role: "admin_rh", status: "inactif", count: 1 },
    { role: "robot", status: "actif", count: 9 },
  ];

  it("compte les actifs par rôle, du plus nombreux au moins nombreux", () => {
    expect(activeStaffByRole(rows)).toEqual([
      { role: "formateur", label: "Formateur", count: 12 },
      { role: "directeur_partenaire", label: "Directeur partenaire", count: 5 },
      { role: "maintenancier", label: "Maintenancier", count: 3 },
    ]);
  });

  it("compte les comptes d'un statut, tous rôles confondus", () => {
    expect(countWithStatus(rows, "invite")).toBe(2);
    expect(countWithStatus(rows, "actif")).toBe(29);
    expect(countWithStatus(rows, "archive")).toBe(0);
  });
});
