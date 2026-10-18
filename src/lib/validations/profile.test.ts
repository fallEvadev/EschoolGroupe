import { describe, expect, it } from "vitest";

import { myPhoneSchema } from "./profile";

describe("myPhoneSchema", () => {
  it("accepte un numéro sénégalais avec ou sans indicatif, espaces ignorés", () => {
    expect(myPhoneSchema.parse({ phone: "77 123 45 67" }).phone).toBe(
      "771234567",
    );
    expect(myPhoneSchema.parse({ phone: "+221 77 123 45 67" }).phone).toBe(
      "+221771234567",
    );
    expect(myPhoneSchema.parse({ phone: "33.821.12.34" }).phone).toBe(
      "338211234",
    );
  });

  it("un champ vide efface le numéro", () => {
    expect(myPhoneSchema.parse({ phone: "   " }).phone).toBeNull();
  });

  it("refuse un numéro invalide avec un message en français", () => {
    for (const phone of ["12345", "88 123 45 67", "77 123 45", "abc"]) {
      const result = myPhoneSchema.safeParse({ phone });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Numéro invalide");
      }
    }
  });
});
