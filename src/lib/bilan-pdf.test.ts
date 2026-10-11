import { describe, expect, it } from "vitest";

import {
  buildBilanPdfPath,
  formatFileSize,
  isValidBilanPdfPath,
  MAX_BILAN_PDF_BYTES,
} from "@/lib/bilan-pdf";
import {
  bilanIdSchema,
  bilanPdfConfirmSchema,
  bilanPdfUploadSchema,
} from "@/lib/validations/bilans";

const BILAN = "0b6f5d52-1d4c-4a45-8f1a-7c2e9a4d5b33";
const OTHER = "7d2a9c10-5e3b-4f8a-b1c4-9e6f0a2d3c55";
const UNIQUE = "a1b2c3d4-0000-4000-8000-123456789abc";

describe("chemins de PDF", () => {
  it("construit un chemin accepté par le contrôle, avec un nom nettoyé", () => {
    const path = buildBilanPdfPath(BILAN, "Bilan été 2026 (final).pdf", UNIQUE);
    expect(path).toBe(`${BILAN}/${UNIQUE}-Bilan-ete-2026-final-.pdf`);
    expect(isValidBilanPdfPath(BILAN, path)).toBe(true);
  });

  it("garde un nom par défaut pour un nom entièrement illisible", () => {
    expect(buildBilanPdfPath(BILAN, "???", UNIQUE)).toBe(
      `${BILAN}/${UNIQUE}-bilan.pdf`,
    );
  });

  it("refuse le chemin d'un autre bilan, une remontée de dossier ou un suffixe libre", () => {
    const path = buildBilanPdfPath(BILAN, "bilan.pdf", UNIQUE);
    expect(isValidBilanPdfPath(OTHER, path)).toBe(false);
    expect(isValidBilanPdfPath(BILAN, `${BILAN}/../secret.pdf`)).toBe(false);
    expect(isValidBilanPdfPath(BILAN, `${BILAN}/${UNIQUE}-a/b.pdf`)).toBe(
      false,
    );
    expect(isValidBilanPdfPath(BILAN, `${BILAN}/n-importe-quoi.pdf`)).toBe(
      false,
    );
  });
});

describe("formatFileSize", () => {
  it.each([
    [1, "1 Ko"],
    [850 * 1024, "850 Ko"],
    [2.4 * 1024 * 1024, "2,4 Mo"],
  ])("%s octets -> %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

describe("schémas de dépôt", () => {
  const valid = {
    bilanId: BILAN,
    fileName: "bilan.pdf",
    mimeType: "application/pdf",
    size: 120_000,
  };

  it("accepte un PDF de taille raisonnable", () => {
    expect(bilanPdfUploadSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse un autre type, un fichier vide ou trop gros", () => {
    expect(
      bilanPdfUploadSchema.safeParse({ ...valid, mimeType: "image/png" })
        .success,
    ).toBe(false);
    expect(bilanPdfUploadSchema.safeParse({ ...valid, size: 0 }).success).toBe(
      false,
    );
    expect(
      bilanPdfUploadSchema.safeParse({
        ...valid,
        size: MAX_BILAN_PDF_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("exige un bilan valide et, à la confirmation, un chemin", () => {
    expect(
      bilanPdfUploadSchema.safeParse({ ...valid, bilanId: "x" }).success,
    ).toBe(false);
    expect(bilanPdfConfirmSchema.safeParse(valid).success).toBe(false);
    expect(
      bilanPdfConfirmSchema.safeParse({ ...valid, storagePath: "a/b" }).success,
    ).toBe(true);
    expect(bilanIdSchema.safeParse({ bilanId: BILAN }).success).toBe(true);
    expect(bilanIdSchema.safeParse({ bilanId: "x" }).success).toBe(false);
  });
});
