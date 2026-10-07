import { describe, expect, it } from "vitest";

import { canAccessPath } from "@/lib/auth/roles";

import {
  CODE_LENGTH,
  formatCode,
  generateCode,
  isCodeFormat,
} from "./daily-codes";

describe("generateCode", () => {
  it("produit 6 chiffres et garde les zéros initiaux", () => {
    expect(generateCode(() => 4281)).toBe("004281");
    expect(generateCode(() => 0)).toBe("000000");
    expect(generateCode(() => 999_999)).toBe("999999");
  });

  it("demande un tirage strictement inférieur à un million", () => {
    let received = 0;
    generateCode((max) => {
      received = max;
      return 0;
    });
    expect(received).toBe(1_000_000);
  });

  it("donne toujours un code valide", () => {
    for (const value of [0, 7, 42, 12_345, 654_321, 999_999]) {
      const code = generateCode(() => value);
      expect(code).toHaveLength(CODE_LENGTH);
      expect(isCodeFormat(code)).toBe(true);
    }
  });
});

describe("isCodeFormat", () => {
  it("accepte exactement 6 chiffres", () => {
    expect(isCodeFormat("123456")).toBe(true);
    expect(isCodeFormat("000000")).toBe(true);
  });

  it.each(["12345", "1234567", "12345a", "12 345", "", " 123456", "١٢٣٤٥٦"])(
    "refuse « %s »",
    (value) => {
      expect(isCodeFormat(value)).toBe(false);
    },
  );
});

describe("page Codes du jour", () => {
  it("est réservée à l'Admin Pédagogie et au Super-Admin", () => {
    expect(canAccessPath("admin_pedagogie", "/admin/codes")).toBe(true);
    expect(canAccessPath("super_admin", "/admin/codes")).toBe(true);
    for (const role of [
      "admin_rh",
      "admin_maintenance",
      "formateur",
      "maintenancier",
      "directeur_partenaire",
    ] as const) {
      expect(canAccessPath(role, "/admin/codes")).toBe(false);
    }
  });
});

describe("formatCode", () => {
  it("groupe par trois chiffres", () => {
    expect(formatCode("428105")).toBe("428 105");
    expect(formatCode("004281")).toBe("004 281");
  });

  it("laisse tel quel un texte qui n'est pas un code", () => {
    expect(formatCode("abc")).toBe("abc");
  });
});
