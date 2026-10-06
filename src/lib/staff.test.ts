import { describe, expect, it } from "vitest";

import { formatPhone, initials, splitFullName } from "./staff";

describe("formatPhone", () => {
  it("groupe les chiffres à la sénégalaise", () => {
    expect(formatPhone("771234567")).toBe("77 123 45 67");
    expect(formatPhone("+221771234567")).toBe("+221 77 123 45 67");
  });

  it("laisse un format inconnu tel quel", () => {
    expect(formatPhone("12345")).toBe("12345");
  });
});

describe("splitFullName", () => {
  it("prend le dernier mot comme nom de famille", () => {
    expect(splitFullName("Mamadou Lamine Diop")).toEqual({
      firstName: "Mamadou Lamine",
      lastName: "Diop",
    });
  });

  it("gère un nom en un seul mot", () => {
    expect(splitFullName("Awa")).toEqual({ firstName: "Awa", lastName: "" });
  });
});

describe("initials", () => {
  it("garde les deux premières initiales", () => {
    expect(initials("babacar ndiaye")).toBe("BN");
  });
});
