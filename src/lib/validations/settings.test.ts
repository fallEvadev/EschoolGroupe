import { describe, expect, it } from "vitest";

import { organizationSettingsSchema } from "./settings";

const valid = {
  organizationName: "E-School Groupe",
  academicYear: "2025-2026",
  currentSemester: 1,
};

describe("organizationSettingsSchema", () => {
  it("accepte des paramètres corrects", () => {
    expect(organizationSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("retire les espaces autour du nom", () => {
    const parsed = organizationSettingsSchema.parse({
      ...valid,
      organizationName: "  E-School  ",
    });
    expect(parsed.organizationName).toBe("E-School");
  });

  it.each(["2025", "2025/2026", "2025-2027", "2026-2025", "abcd-efgh"])(
    "refuse l'année scolaire « %s »",
    (academicYear) => {
      expect(
        organizationSettingsSchema.safeParse({ ...valid, academicYear })
          .success,
      ).toBe(false);
    },
  );

  it.each([0, 3, 1.5, Number.NaN])("refuse le semestre %s", (semester) => {
    expect(
      organizationSettingsSchema.safeParse({
        ...valid,
        currentSemester: semester,
      }).success,
    ).toBe(false);
  });

  it("refuse un nom trop court", () => {
    expect(
      organizationSettingsSchema.safeParse({ ...valid, organizationName: "E" })
        .success,
    ).toBe(false);
  });
});
