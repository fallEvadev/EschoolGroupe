import { describe, expect, it } from "vitest";

import { canAccessPath } from "@/lib/auth/roles";

import {
  buildProgramPath,
  defaultProgramTitle,
  isValidProgramPath,
  looksLikePdf,
  programMonthFromDate,
  programMonthToDate,
  splitPrograms,
  type ProgramItem,
} from "./programs";

const UNIQUE = "0b8f3c1e-52a4-4d6b-9c7e-1a2b3c4d5e6f";

describe("programMonthFromDate / programMonthToDate", () => {
  it("convertit entre le mois et la date stockée", () => {
    expect(programMonthFromDate("2026-10-01")).toBe("2026-10");
    expect(programMonthToDate("2026-10")).toBe("2026-10-01");
  });
});

describe("buildProgramPath", () => {
  it("range le fichier par mois, avec un nom sûr", () => {
    expect(
      buildProgramPath("2026-10", "Programme Octobre (v2).PDF", UNIQUE),
    ).toBe(`2026-10/${UNIQUE}-Programme-Octobre-v2-.PDF`);
  });

  it("garde un nom par défaut si tout est retiré", () => {
    expect(buildProgramPath("2026-10", "???", UNIQUE)).toBe(
      `2026-10/${UNIQUE}-programme.pdf`,
    );
  });
});

describe("isValidProgramPath", () => {
  it("accepte un chemin produit par buildProgramPath", () => {
    const path = buildProgramPath("2026-10", "programme.pdf", UNIQUE);
    expect(isValidProgramPath(path, "2026-10")).toBe(true);
  });

  it("refuse un chemin d'un autre mois", () => {
    const path = buildProgramPath("2026-10", "programme.pdf", UNIQUE);
    expect(isValidProgramPath(path, "2026-11")).toBe(false);
  });

  it.each([
    "2026-10/",
    `2026-10/${UNIQUE}`,
    `2026-10/${UNIQUE}-../autre/x.pdf`,
    `2026-10/../2026-09/${UNIQUE}-x.pdf`,
    `2026-10/${UNIQUE}-a/b.pdf`,
    "2026-10/pas-un-uuid-x.pdf",
    `2026-10/${UNIQUE}-${"x".repeat(81)}`,
  ])("refuse le chemin « %s »", (path) => {
    expect(isValidProgramPath(path, "2026-10")).toBe(false);
  });
});

describe("looksLikePdf", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  it("reconnaît l'en-tête d'un PDF", () => {
    expect(looksLikePdf(bytes("%PDF-1.7\n..."))).toBe(true);
    expect(looksLikePdf(bytes("%PDF-"))).toBe(true);
  });

  it("refuse tout ce qui n'est pas un PDF", () => {
    expect(looksLikePdf(bytes("PK\u0003\u0004"))).toBe(false); // zip / docx
    expect(looksLikePdf(bytes("<html>"))).toBe(false);
    expect(looksLikePdf(bytes(" %PDF-1.7"))).toBe(false);
    expect(looksLikePdf(bytes("%PDF"))).toBe(false); // trop court
    expect(looksLikePdf(new Uint8Array())).toBe(false);
  });
});

describe("page Programme mensuel (Direction)", () => {
  it("est réservée à l'Admin Pédagogie et au Super-Admin", () => {
    expect(canAccessPath("admin_pedagogie", "/admin/programmes")).toBe(true);
    expect(canAccessPath("super_admin", "/admin/programmes")).toBe(true);
    for (const role of [
      "admin_rh",
      "admin_maintenance",
      "formateur",
      "maintenancier",
      "directeur_partenaire",
    ] as const) {
      expect(canAccessPath(role, "/admin/programmes")).toBe(false);
    }
  });
});

describe("defaultProgramTitle", () => {
  it("propose un titre avec le mois", () => {
    expect(defaultProgramTitle("octobre 2026")).toBe(
      "Programme de octobre 2026",
    );
  });
});

describe("splitPrograms", () => {
  const program = (
    id: string,
    month: string,
    status: ProgramItem["status"] = "actif",
  ): ProgramItem => ({
    id,
    month,
    title: `Programme ${month}`,
    fileName: `${month}.pdf`,
    sizeBytes: 1000,
    publishedAt: "2026-09-30T10:00:00Z",
    status,
  });

  const programs = [
    program("sept", "2026-09"),
    program("oct", "2026-10"),
    program("nov", "2026-11"),
    program("aout", "2026-08"),
    program("janv", "2027-01"),
    program("oct-ancien", "2026-10", "remplace"),
  ];

  it("trouve le programme du mois en cours", () => {
    expect(splitPrograms(programs, "2026-10").current?.id).toBe("oct");
  });

  it("classe les programmes à venir et les précédents, du plus récent au plus ancien", () => {
    const result = splitPrograms(programs, "2026-10");
    expect(result.upcoming.map((p) => p.id)).toEqual(["janv", "nov"]);
    expect(result.previous.map((p) => p.id)).toEqual(["sept", "aout"]);
  });

  it("ignore les versions remplacées", () => {
    const all = [
      ...splitPrograms(programs, "2026-10").upcoming,
      ...splitPrograms(programs, "2026-10").previous,
    ];
    expect(all.some((p) => p.id === "oct-ancien")).toBe(false);
  });

  it("n'a pas de programme courant quand le mois n'est pas publié", () => {
    expect(splitPrograms(programs, "2026-12").current).toBeNull();
  });

  it("renvoie des listes vides sans programme", () => {
    expect(splitPrograms([], "2026-10")).toEqual({
      current: null,
      upcoming: [],
      previous: [],
    });
  });
});
