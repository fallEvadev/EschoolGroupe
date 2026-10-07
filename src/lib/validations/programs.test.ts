import { describe, expect, it } from "vitest";

import { programIdSchema, programUploadSchema } from "./programs";

const valid = {
  month: "2026-10",
  title: "  Programme de octobre 2026  ",
  fileName: "programme-octobre.pdf",
  mimeType: "application/pdf",
  size: 2_500_000,
};

describe("programUploadSchema", () => {
  it("accepte un PDF correct et nettoie le titre", () => {
    expect(programUploadSchema.parse(valid).title).toBe(
      "Programme de octobre 2026",
    );
  });

  it("accepte exactement 10 Mo", () => {
    expect(
      programUploadSchema.safeParse({ ...valid, size: 10 * 1024 * 1024 })
        .success,
    ).toBe(true);
  });

  it.each([
    { size: 10 * 1024 * 1024 + 1 },
    { size: 0 },
    { size: 1.5 },
    { mimeType: "image/png" },
    { mimeType: "application/msword" },
    { month: "2026-13" },
    { month: "octobre" },
    { month: "2026-10-01" },
    { title: "ab" },
    { title: "  " },
    { title: "x".repeat(151) },
    { fileName: " " },
    { fileName: "x".repeat(201) },
  ])("refuse la valeur %j", (override) => {
    expect(
      programUploadSchema.safeParse({ ...valid, ...override }).success,
    ).toBe(false);
  });
});

describe("programIdSchema", () => {
  it("exige un identifiant valide", () => {
    expect(
      programIdSchema.safeParse({
        programId: "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10",
      }).success,
    ).toBe(true);
    expect(programIdSchema.safeParse({ programId: "abc" }).success).toBe(false);
  });
});
