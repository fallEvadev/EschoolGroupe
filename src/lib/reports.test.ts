import { describe, expect, it } from "vitest";

import {
  isEditable,
  isLocked,
  missingForSubmit,
  parseIssues,
  sortReportItems,
  type ReportListItem,
} from "./reports";
import { reportSchema, reviewReportSchema } from "./validations/reports";

const attendanceId = "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10";
const base = {
  attendanceId,
  classes: " 3e A ",
  courseTheme: " Les tableurs ",
  equipmentOk: true,
  issues: [],
  submit: true,
};

describe("reportSchema", () => {
  it("nettoie un rapport complet", () => {
    const parsed = reportSchema.parse(base);
    expect(parsed.classes).toBe("3e A");
    expect(parsed.courseTheme).toBe("Les tableurs");
  });

  it("accepte un brouillon incomplet", () => {
    expect(
      reportSchema.safeParse({
        ...base,
        classes: "",
        courseTheme: "",
        submit: false,
      }).success,
    ).toBe(true);
  });

  it("refuse l'envoi d'un rapport incomplet", () => {
    expect(reportSchema.safeParse({ ...base, classes: "" }).success).toBe(
      false,
    );
    expect(reportSchema.safeParse({ ...base, courseTheme: "ab" }).success).toBe(
      false,
    );
  });

  it("exige des pannes quand le matériel n'est pas en bon état", () => {
    expect(
      reportSchema.safeParse({ ...base, equipmentOk: false, issues: [] })
        .success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({
        ...base,
        equipmentOk: false,
        issues: [{ equipment: "PC 4", description: "Ne démarre plus" }],
      }).success,
    ).toBe(true);
  });

  it("refuse des pannes avec un matériel indiqué en bon état", () => {
    expect(
      reportSchema.safeParse({
        ...base,
        issues: [{ equipment: "PC 4", description: "Ne démarre plus" }],
      }).success,
    ).toBe(false);
  });

  it.each([
    { attendanceId: "abc" },
    { classes: "x".repeat(301), submit: false },
    { courseTheme: "x".repeat(1001), submit: false },
    { equipmentOk: undefined },
  ])("refuse %j", (override) => {
    expect(reportSchema.safeParse({ ...base, ...override }).success).toBe(
      false,
    );
  });

  it("refuse plus de 20 pannes", () => {
    const issues = Array.from({ length: 21 }, (_, i) => ({
      equipment: `PC ${i}`,
      description: "Panne",
    }));
    expect(
      reportSchema.safeParse({ ...base, equipmentOk: false, issues }).success,
    ).toBe(false);
  });
});

describe("reviewReportSchema", () => {
  const reportId = attendanceId;
  const corrections = {
    classes: "3e B",
    courseTheme: "Les tableurs",
    equipmentOk: true,
    issues: [],
  };

  it("accepte une validation simple", () => {
    expect(
      reviewReportSchema.safeParse({
        reportId,
        decision: "valide",
        comment: "",
      }).success,
    ).toBe(true);
  });

  it("exige un commentaire pour demander une modification", () => {
    const input = { reportId, decision: "a_modifier" };
    expect(
      reviewReportSchema.safeParse({ ...input, comment: "  " }).success,
    ).toBe(false);
    expect(
      reviewReportSchema.safeParse({ ...input, comment: "Précisez la classe" })
        .success,
    ).toBe(true);
  });

  it("exige un contenu corrigé pour valider avec corrections", () => {
    const input = {
      reportId,
      decision: "valide_avec_corrections",
      comment: "",
    };
    expect(reviewReportSchema.safeParse(input).success).toBe(false);
    expect(
      reviewReportSchema.safeParse({ ...input, corrections }).success,
    ).toBe(true);
    expect(
      reviewReportSchema.safeParse({
        ...input,
        corrections: { ...corrections, classes: "" },
      }).success,
    ).toBe(false);
  });

  it("refuse un contenu corrigé pour les autres décisions", () => {
    for (const decision of ["valide", "a_modifier"]) {
      expect(
        reviewReportSchema.safeParse({
          reportId,
          decision,
          comment: "Précisez",
          corrections,
        }).success,
      ).toBe(false);
    }
  });

  it("garde la cohérence matériel / pannes dans les corrections", () => {
    const input = {
      reportId,
      decision: "valide_avec_corrections",
      comment: "",
    };
    expect(
      reviewReportSchema.safeParse({
        ...input,
        corrections: { ...corrections, equipmentOk: false },
      }).success,
    ).toBe(false);
    expect(
      reviewReportSchema.safeParse({
        ...input,
        corrections: {
          ...corrections,
          issues: [{ equipment: "PC 1", description: "HS" }],
        },
      }).success,
    ).toBe(false);
  });

  it("refuse une décision inconnue", () => {
    expect(
      reviewReportSchema.safeParse({
        reportId,
        decision: "soumis",
        comment: "",
      }).success,
    ).toBe(false);
  });
});

describe("statuts", () => {
  it("modifiable : brouillon et à modifier seulement", () => {
    expect(isEditable("brouillon")).toBe(true);
    expect(isEditable("a_modifier")).toBe(true);
    expect(isEditable("soumis")).toBe(false);
    expect(isEditable("valide")).toBe(false);
  });

  it("verrouillé : validé avec ou sans corrections", () => {
    expect(isLocked("valide")).toBe(true);
    expect(isLocked("valide_avec_corrections")).toBe(true);
    expect(isLocked("a_modifier")).toBe(false);
  });
});

describe("missingForSubmit", () => {
  it("signale le premier manque", () => {
    expect(
      missingForSubmit({
        classes: "",
        courseTheme: "",
        equipmentOk: true,
        issues: [],
      }),
    ).toMatch(/classes/);
    expect(
      missingForSubmit({
        classes: "3e A",
        courseTheme: "Tableurs",
        equipmentOk: true,
        issues: [],
      }),
    ).toBeNull();
  });
});

describe("parseIssues", () => {
  it("ignore les lignes mal formées", () => {
    expect(
      parseIssues([
        { equipment: "PC 1", description: "HS" },
        { equipment: 3 },
        "x",
        null,
      ]),
    ).toEqual([{ equipment: "PC 1", description: "HS" }]);
    expect(parseIssues("x")).toEqual([]);
  });
});

describe("sortReportItems", () => {
  const item = (
    date: string,
    status: "brouillon" | "soumis" | "a_modifier" | "valide" | null,
  ): ReportListItem => ({
    attendanceId: date + String(status),
    date,
    schoolName: "École",
    startsAt: "08:00",
    endsAt: "10:00",
    report: status ? { id: "r", status } : null,
  });

  it("met d'abord ce qui demande une action, puis par date décroissante", () => {
    const sorted = sortReportItems([
      item("2026-10-08", "valide"),
      item("2026-10-05", null),
      item("2026-10-07", "soumis"),
      item("2026-10-06", "a_modifier"),
      item("2026-10-04", "brouillon"),
    ]);
    expect(sorted.map((i) => i.date)).toEqual([
      "2026-10-06",
      "2026-10-05",
      "2026-10-04",
      "2026-10-08",
      "2026-10-07",
    ]);
  });
});
