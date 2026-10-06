import { describe, expect, it } from "vitest";

import {
  buildStoragePath,
  decisionNeedsReason,
  formatFileSize,
  reviewProgress,
} from "./staff-documents";
import {
  documentReviewSchema,
  documentUploadSchema,
} from "./validations/staff-documents";

const PROFILE_ID = "8f14e45f-ceea-467a-9f1a-2c1b6b0f5e11";

describe("buildStoragePath", () => {
  it("range le fichier par fiche et par type, avec un nom sûr", () => {
    expect(
      buildStoragePath(
        PROFILE_ID,
        "cni",
        "Carte d'identité (recto).PDF",
        "abc",
      ),
    ).toBe(`${PROFILE_ID}/cni/abc-Carte-d-identite-recto-.PDF`);
  });

  it("garde un nom par défaut si tout est retiré", () => {
    expect(buildStoragePath(PROFILE_ID, "cv", "???", "abc")).toBe(
      `${PROFILE_ID}/cv/abc-document`,
    );
  });
});

describe("formatFileSize", () => {
  it("affiche des Ko et des Mo", () => {
    expect(formatFileSize(300)).toBe("1 Ko");
    expect(formatFileSize(250_000)).toBe("244 Ko");
    expect(formatFileSize(1_300_000)).toBe("1,2 Mo");
  });
});

describe("documentUploadSchema", () => {
  const valid = {
    profileId: PROFILE_ID,
    kind: "cv",
    fileName: "cv.pdf",
    mimeType: "application/pdf",
    size: 120_000,
  };

  it("accepte un PDF pour un CV", () => {
    expect(documentUploadSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse un PDF pour une photo", () => {
    expect(
      documentUploadSchema.safeParse({ ...valid, kind: "photo" }).success,
    ).toBe(false);
  });

  it("refuse un fichier de plus de 5 Mo", () => {
    expect(
      documentUploadSchema.safeParse({ ...valid, size: 6 * 1024 * 1024 })
        .success,
    ).toBe(false);
  });

  it("refuse un format non prévu", () => {
    expect(
      documentUploadSchema.safeParse({
        ...valid,
        fileName: "cv.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).success,
    ).toBe(false);
  });
});

describe("reviewProgress", () => {
  it("compte les pièces obligatoires validées, à vérifier et rejetées", () => {
    expect(
      reviewProgress([
        { kind: "cv", reviewStatus: "valide" },
        { kind: "cni", reviewStatus: "a_verifier" },
        { kind: "photo", reviewStatus: "rejete" },
        { kind: "diplome", reviewStatus: "valide" },
      ]),
    ).toEqual({ requiredValidated: 1, pending: 1, rejected: 1 });
  });

  it("ne compte pas une pièce facultative parmi les obligatoires", () => {
    expect(
      reviewProgress([{ kind: "diplome", reviewStatus: "valide" }])
        .requiredValidated,
    ).toBe(0);
  });

  it("renvoie des zéros pour un dossier vide", () => {
    expect(reviewProgress([])).toEqual({
      requiredValidated: 0,
      pending: 0,
      rejected: 0,
    });
  });
});

describe("decisionNeedsReason", () => {
  it("exige un motif pour rejeter, pas pour valider", () => {
    expect(decisionNeedsReason("rejete")).toBe(true);
    expect(decisionNeedsReason("valide")).toBe(false);
  });
});

describe("documentReviewSchema", () => {
  const base = {
    documentId: PROFILE_ID,
    decision: "rejete",
    reason: "  Photo floue  ",
  };

  it("accepte un rejet motivé et nettoie le motif", () => {
    expect(documentReviewSchema.parse(base).reason).toBe("Photo floue");
  });

  it("refuse un rejet sans motif", () => {
    expect(
      documentReviewSchema.safeParse({ ...base, reason: " " }).success,
    ).toBe(false);
  });

  it("accepte une validation sans motif", () => {
    expect(
      documentReviewSchema.safeParse({
        ...base,
        decision: "valide",
        reason: "",
      }).success,
    ).toBe(true);
  });

  it("refuse une décision inconnue ou un document invalide", () => {
    expect(
      documentReviewSchema.safeParse({ ...base, decision: "a_verifier" })
        .success,
    ).toBe(false);
    expect(
      documentReviewSchema.safeParse({ ...base, documentId: "abc" }).success,
    ).toBe(false);
  });
});
