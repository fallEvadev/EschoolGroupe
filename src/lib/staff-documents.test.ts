import { describe, expect, it } from "vitest";

import { buildStoragePath, formatFileSize } from "./staff-documents";
import { documentUploadSchema } from "./validations/staff-documents";

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
