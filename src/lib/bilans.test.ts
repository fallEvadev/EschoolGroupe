import { describe, expect, it } from "vitest";

import {
  defaultPeriodStart,
  isBilanKind,
  monthEnd,
  mondayOf,
  periodInputValue,
  periodLabel,
  periodStartFrom,
  summarizeGeneration,
  weekEnd,
} from "@/lib/bilans";
import { generateBilansSchema } from "@/lib/validations/bilans";

describe("semaines", () => {
  it("renvoie le lundi de la semaine, quel que soit le jour", () => {
    // 2026-10-05 est un lundi.
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(mondayOf("2026-10-07")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
  });

  it("traverse un changement de mois ou d'année", () => {
    expect(mondayOf("2026-01-01")).toBe("2025-12-29");
    expect(weekEnd("2026-10-26")).toBe("2026-11-01");
  });
});

describe("mois", () => {
  it("donne le dernier jour du mois, y compris février", () => {
    expect(monthEnd("2026-10-01")).toBe("2026-10-31");
    expect(monthEnd("2026-02-01")).toBe("2026-02-28");
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
    expect(monthEnd("2026-11-01")).toBe("2026-11-30");
  });
});

describe("periodStartFrom", () => {
  it("prend le lundi pour une semaine et le 1er pour un mois", () => {
    expect(periodStartFrom("semaine", "2026-10-08")).toBe("2026-10-05");
    expect(periodStartFrom("mois", "2026-10")).toBe("2026-10-01");
  });

  it("refuse une saisie invalide", () => {
    expect(periodStartFrom("semaine", "2026-02-30")).toBeNull();
    expect(periodStartFrom("semaine", "octobre")).toBeNull();
    expect(periodStartFrom("mois", "2026-13")).toBeNull();
    expect(periodStartFrom("mois", "2026-10-05")).toBeNull();
    expect(periodStartFrom("mois", "")).toBeNull();
  });
});

describe("defaultPeriodStart", () => {
  it("propose la dernière semaine terminée", () => {
    // Le dimanche 11/10/2026 est dans la semaine du 05/10 : on propose celle du 28/09.
    expect(defaultPeriodStart("semaine", "2026-10-11")).toBe("2026-09-28");
    expect(defaultPeriodStart("semaine", "2026-10-12")).toBe("2026-10-05");
  });

  it("propose le dernier mois terminé", () => {
    expect(defaultPeriodStart("mois", "2026-10-11")).toBe("2026-09-01");
    expect(defaultPeriodStart("mois", "2026-01-15")).toBe("2025-12-01");
  });
});

describe("libellés", () => {
  it("écrit la semaine et le mois en français", () => {
    expect(periodLabel("semaine", "2026-10-05")).toBe(
      "Semaine du 05/10/2026 au 11/10/2026",
    );
    expect(periodLabel("mois", "2026-10-01")).toBe("Octobre 2026");
  });

  it("remet le bon format dans le champ de saisie", () => {
    expect(periodInputValue("semaine", "2026-10-05")).toBe("2026-10-05");
    expect(periodInputValue("mois", "2026-10-01")).toBe("2026-10");
  });

  it("reconnaît les types de période", () => {
    expect(isBilanKind("semaine")).toBe(true);
    expect(isBilanKind("annee")).toBe(false);
  });
});

describe("summarizeGeneration", () => {
  it("annonce qu'il n'y a rien à générer", () => {
    expect(summarizeGeneration([])).toBe(
      "Aucun rapport validé sur cette période : aucun bilan à générer.",
    );
  });

  it("résume créés, actualisés et déjà publiés, au singulier et au pluriel", () => {
    expect(
      summarizeGeneration([{ outcome: "cree" }, { outcome: "cree" }]),
    ).toBe("Bilans : 2 créés.");
    expect(
      summarizeGeneration([
        { outcome: "cree" },
        { outcome: "actualise" },
        { outcome: "ignore" },
        { outcome: "ignore" },
      ]),
    ).toBe("Bilans : 1 créé, 1 actualisé, 2 déjà publiés (inchangés).");
  });
});

describe("generateBilansSchema", () => {
  it("calcule le début de période côté serveur", () => {
    expect(
      generateBilansSchema.parse({ kind: "semaine", value: " 2026-10-08 " }),
    ).toEqual({ kind: "semaine", periodStart: "2026-10-05" });
    expect(
      generateBilansSchema.parse({ kind: "mois", value: "2026-10" }),
    ).toEqual({ kind: "mois", periodStart: "2026-10-01" });
  });

  it("refuse un type inconnu ou une saisie invalide", () => {
    expect(
      generateBilansSchema.safeParse({ kind: "annee", value: "2026" }).success,
    ).toBe(false);
    expect(
      generateBilansSchema.safeParse({ kind: "mois", value: "pas un mois" })
        .success,
    ).toBe(false);
  });
});
