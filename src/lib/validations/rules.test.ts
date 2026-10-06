import { describe, expect, it } from "vitest";

import { acceptRulesSchema, publishRulesSchema } from "./rules";

describe("publishRulesSchema", () => {
  const valid = {
    title: "  Règlement intérieur du personnel ",
    content: "  Article 1. Les horaires de présence doivent être respectés.  ",
  };

  it("nettoie le titre et le texte", () => {
    expect(publishRulesSchema.parse(valid)).toEqual({
      title: "Règlement intérieur du personnel",
      content: "Article 1. Les horaires de présence doivent être respectés.",
    });
  });

  it("refuse un titre trop court ou trop long", () => {
    expect(publishRulesSchema.safeParse({ ...valid, title: "ab" }).success).toBe(
      false,
    );
    expect(
      publishRulesSchema.safeParse({ ...valid, title: "x".repeat(151) })
        .success,
    ).toBe(false);
  });

  it("refuse un texte trop court ou trop long", () => {
    expect(
      publishRulesSchema.safeParse({ ...valid, content: "Trop court" })
        .success,
    ).toBe(false);
    expect(
      publishRulesSchema.safeParse({ ...valid, content: "x".repeat(50001) })
        .success,
    ).toBe(false);
  });
});

describe("acceptRulesSchema", () => {
  const rulesId = "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10";

  it("accepte une case cochée avec une version valide", () => {
    expect(acceptRulesSchema.safeParse({ rulesId, accepted: true }).success).toBe(
      true,
    );
  });

  it("refuse une case non cochée", () => {
    const result = acceptRulesSchema.safeParse({ rulesId, accepted: false });
    expect(result.success).toBe(false);
  });

  it("refuse une version qui n'est pas un identifiant valide", () => {
    expect(
      acceptRulesSchema.safeParse({ rulesId: "abc", accepted: true }).success,
    ).toBe(false);
  });
});
