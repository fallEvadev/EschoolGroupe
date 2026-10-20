import { describe, expect, it } from "vitest";

import {
  bilanFileName,
  bilanTitle,
  buildBilanDocx,
  sortReports,
  summarizeReports,
  timeRange,
  type BilanDocData,
  type BilanDocReport,
  type DocImage,
} from "@/lib/exports/bilan-docx";

/** PNG valide de 1 × 1 pixel (rouge), pour essayer le logo et la signature. */
const PIXEL = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const image: DocImage = {
  data: PIXEL,
  type: "png",
  size: { width: 300, height: 100 },
};

function report(patch: Partial<BilanDocReport> = {}): BilanDocReport {
  return {
    date: "2026-10-05",
    startsAt: "08:00:00",
    endsAt: "10:00:00",
    formateur: "Awa Fall",
    classes: "3e A",
    courseTheme: "Les tableurs",
    equipmentOk: true,
    issues: [],
    ...patch,
  };
}

const data: BilanDocData = {
  organizationName: "E-School",
  academicYear: "2026-2027",
  schoolName: "École Les Cèdres",
  kind: "semaine",
  periodStart: "2026-10-05",
  reports: [report()],
  logo: null,
  signature: null,
  generatedOn: "2026-10-12",
};

describe("sortReports", () => {
  it("trie par date puis par heure de début, sans modifier la liste d'origine", () => {
    const original = [
      report({ date: "2026-10-07" }),
      report({ date: "2026-10-05", startsAt: "10:00:00" }),
      report({ date: "2026-10-05", startsAt: "08:00:00" }),
    ];
    const sorted = sortReports(original);
    expect(sorted.map((r) => `${r.date} ${r.startsAt}`)).toEqual([
      "2026-10-05 08:00:00",
      "2026-10-05 10:00:00",
      "2026-10-07 08:00:00",
    ]);
    expect(original[0]?.date).toBe("2026-10-07");
  });
});

describe("summarizeReports", () => {
  it("compte séances, formateurs différents et pannes", () => {
    const summary = summarizeReports([
      report(),
      report({ formateur: "awa fall " }),
      report({
        formateur: "Moussa Ndiaye",
        equipmentOk: false,
        issues: [
          { equipment: "PC 1", description: "HS" },
          { equipment: "PC 2", description: "HS" },
        ],
      }),
    ]);
    expect(summary).toEqual({
      sessions: 3,
      formateurs: 2,
      issues: 2,
      reportsWithIssues: 1,
    });
  });

  it("renvoie des zéros sans rapport", () => {
    expect(summarizeReports([])).toEqual({
      sessions: 0,
      formateurs: 0,
      issues: 0,
      reportsWithIssues: 0,
    });
  });
});

describe("noms et titres", () => {
  it("titre selon la période", () => {
    expect(bilanTitle("semaine")).toBe("Bilan hebdomadaire");
    expect(bilanTitle("mois")).toBe("Bilan mensuel");
  });

  it("nom de fichier sans accent ni caractère spécial", () => {
    expect(
      bilanFileName("École Les Cèdres / Saint-Louis", "semaine", "2026-10-05"),
    ).toBe("bilan-semaine-2026-10-05-Ecole-Les-Cedres-Saint-Louis.docx");
    expect(bilanFileName("???", "mois", "2026-10-01")).toBe(
      "bilan-mois-2026-10-01-ecole.docx",
    );
  });
});

describe("buildBilanDocx", () => {
  /** Un .docx est une archive ZIP : elle commence par « PK ». */
  const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

  it("produit un fichier .docx valide sans logo ni signature", async () => {
    const bytes = await buildBilanDocx(data);
    expect(isZip(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(2000);
  });

  it("produit un fichier avec logo, signature et pannes", async () => {
    const without = await buildBilanDocx(data);
    const withAll = await buildBilanDocx({
      ...data,
      logo: image,
      signature: image,
      reports: [
        report({
          equipmentOk: false,
          issues: [{ equipment: "PC 4", description: "Ne démarre plus" }],
        }),
        report({ date: "2026-10-06", formateur: "Moussa Ndiaye" }),
      ],
    });
    expect(isZip(withAll)).toBe(true);
    // Les deux images sont embarquées : le fichier est plus gros.
    expect(withAll.length).toBeGreaterThan(without.length);
  });

  it("détaille chaque cours du rapport (heures, classe, effectif, thème)", async () => {
    const single = await buildBilanDocx(data);
    const detailed = await buildBilanDocx({
      ...data,
      reports: [
        report({
          courses: [
            {
              startsAt: "08:00",
              endsAt: "09:00",
              classes: "CI B",
              theme: "Les composants de l'ordinateur",
              headcount: 28,
            },
            {
              startsAt: "10:00",
              endsAt: "11:00",
              classes: "CM1",
              theme: "Utilisation du clavier",
              headcount: 18,
            },
          ],
        }),
      ],
    });
    expect(isZip(detailed)).toBe(true);
    // Deux cours détaillés occupent plus de place qu'une ligne de résumé.
    expect(detailed.length).toBeGreaterThan(single.length);
  });

  it("produit un bilan mensuel sans rapport sans planter", async () => {
    const bytes = await buildBilanDocx({
      ...data,
      kind: "mois",
      periodStart: "2026-10-01",
      reports: [],
    });
    expect(isZip(bytes)).toBe(true);
  });
});

describe("timeRange", () => {
  it("affiche l'horaire prévu pour un ancien pointage", () => {
    expect(timeRange(report())).toBe("08:00 – 10:00");
  });

  it("affiche les heures réelles d'arrivée et de descente quand elles existent", () => {
    expect(
      timeRange(
        report({
          arrivedAt: "2026-10-05T08:03:00Z",
          departedAt: "2026-10-05T10:04:00Z",
        }),
      ),
    ).toBe("08:03 – 10:04");
  });

  it("garde l'horaire prévu tant que la descente n'est pas validée", () => {
    expect(
      timeRange(
        report({ arrivedAt: "2026-10-05T08:03:00Z", departedAt: null }),
      ),
    ).toBe("08:00 – 10:00");
  });
});
