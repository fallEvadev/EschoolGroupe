import { describe, expect, it } from "vitest";

import {
  buildStoragePath,
  decisionNeedsReason,
  formatFileSize,
  isAcceptedFile,
  isValidStoragePath,
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

describe("isValidStoragePath", () => {
  const UNIQUE = "0b8f3c1e-52a4-4d6b-9c7e-1a2b3c4d5e6f";

  it("accepte un chemin produit par buildStoragePath", () => {
    const path = buildStoragePath(PROFILE_ID, "cv", "Mon CV 2026.pdf", UNIQUE);
    expect(isValidStoragePath(path, PROFILE_ID, "cv")).toBe(true);
  });

  it("refuse un chemin d'une autre fiche ou d'un autre type", () => {
    const path = buildStoragePath(PROFILE_ID, "cv", "cv.pdf", UNIQUE);
    expect(
      isValidStoragePath(path, "11111111-1111-4111-8111-111111111111", "cv"),
    ).toBe(false);
    expect(isValidStoragePath(path, PROFILE_ID, "cni")).toBe(false);
  });

  it.each([
    `${PROFILE_ID}/cv/`,
    `${PROFILE_ID}/cv/${UNIQUE}`,
    `${PROFILE_ID}/cv/${UNIQUE}-../autre/fichier.pdf`,
    `${PROFILE_ID}/cv/../${PROFILE_ID}/cni/${UNIQUE}-x.pdf`,
    `${PROFILE_ID}/cv/${UNIQUE}-a/b.pdf`,
    `${PROFILE_ID}/cv/pas-un-uuid-cv.pdf`,
    `${PROFILE_ID}/cv/${UNIQUE}-${"x".repeat(81)}`,
  ])("refuse le chemin « %s »", (path) => {
    expect(isValidStoragePath(path, PROFILE_ID, "cv")).toBe(false);
  });
});

describe("isAcceptedFile", () => {
  it("accepte un PDF de taille normale pour un CV", () => {
    expect(isAcceptedFile("cv", "application/pdf", 120_000)).toBe(true);
  });

  it("refuse un PDF pour une photo", () => {
    expect(isAcceptedFile("photo", "application/pdf", 120_000)).toBe(false);
  });

  it("refuse un fichier vide, trop gros ou à la taille invalide", () => {
    expect(isAcceptedFile("cv", "application/pdf", 0)).toBe(false);
    expect(isAcceptedFile("cv", "application/pdf", 6 * 1024 * 1024)).toBe(
      false,
    );
    expect(isAcceptedFile("cv", "application/pdf", 1.5)).toBe(false);
  });

  it("refuse un type non prévu", () => {
    expect(isAcceptedFile("cv", "application/zip", 1000)).toBe(false);
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
