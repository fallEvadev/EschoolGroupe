import { describe, expect, it } from "vitest";

import {
  deputyInviteSchema,
  deputyRemoveSchema,
  MAX_DEPUTIES_PER_SCHOOL,
} from "./deputies";

const invite = {
  schoolId: "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10",
  fullName: "  Adja   Sow ",
  email: "  Adja.Sow@Example.com ",
  phone: "77 123 45 67",
};

describe("deputyInviteSchema", () => {
  it("nettoie le nom, l'e-mail et le téléphone", () => {
    expect(deputyInviteSchema.parse(invite)).toEqual({
      schoolId: invite.schoolId,
      fullName: "Adja Sow",
      email: "adja.sow@example.com",
      phone: "771234567",
    });
  });

  it("accepte un téléphone vide (devient null)", () => {
    expect(deputyInviteSchema.parse({ ...invite, phone: "" }).phone).toBeNull();
  });

  it.each([
    ["fullName", "Adja"],
    ["fullName", ""],
    ["email", "pas-un-mail"],
    ["phone", "12345"],
    ["schoolId", "abc"],
  ])("refuse %s = %s", (field, value) => {
    expect(
      deputyInviteSchema.safeParse({ ...invite, [field]: value }).success,
    ).toBe(false);
  });

  it("limite à 2 adjoints par école", () => {
    expect(MAX_DEPUTIES_PER_SCHOOL).toBe(2);
  });
});

describe("deputyRemoveSchema", () => {
  const ids = {
    schoolId: "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10",
    profileId: "8a2b1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  };

  it("accepte deux identifiants valides", () => {
    expect(deputyRemoveSchema.safeParse(ids).success).toBe(true);
  });

  it("refuse un identifiant invalide", () => {
    expect(
      deputyRemoveSchema.safeParse({ ...ids, profileId: "abc" }).success,
    ).toBe(false);
  });
});
