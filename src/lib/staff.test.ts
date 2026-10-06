import { describe, expect, it } from "vitest";

import {
  availableStatusActions,
  formatPhone,
  initials,
  needsReason,
  nextStatus,
  splitFullName,
} from "./staff";

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

describe("nextStatus", () => {
  it("désactive seulement un compte actif", () => {
    expect(nextStatus("actif", "deactivate", true)).toBe("inactif");
    expect(nextStatus("inactif", "deactivate", true)).toBeNull();
    expect(nextStatus("invite", "deactivate", false)).toBeNull();
  });

  it("réactive un compte inactif ou archivé", () => {
    expect(nextStatus("inactif", "reactivate", true)).toBe("actif");
    expect(nextStatus("archive", "reactivate", true)).toBe("actif");
    expect(nextStatus("actif", "reactivate", true)).toBeNull();
  });

  it("ramène à « invite » une fiche qui n'a jamais eu de compte", () => {
    expect(nextStatus("archive", "reactivate", false)).toBe("invite");
  });

  it("archive tout statut sauf déjà archivé", () => {
    expect(nextStatus("invite", "archive", false)).toBe("archive");
    expect(nextStatus("actif", "archive", true)).toBe("archive");
    expect(nextStatus("inactif", "archive", true)).toBe("archive");
    expect(nextStatus("archive", "archive", true)).toBeNull();
  });
});

describe("availableStatusActions", () => {
  it("propose désactiver et archiver pour un compte actif", () => {
    expect(availableStatusActions("actif", true)).toEqual([
      "deactivate",
      "archive",
    ]);
  });

  it("propose réactiver et archiver pour un compte inactif", () => {
    expect(availableStatusActions("inactif", true)).toEqual([
      "reactivate",
      "archive",
    ]);
  });

  it("propose seulement archiver pour une invitation", () => {
    expect(availableStatusActions("invite", false)).toEqual(["archive"]);
  });

  it("propose seulement réactiver pour une fiche archivée", () => {
    expect(availableStatusActions("archive", true)).toEqual(["reactivate"]);
  });
});

describe("needsReason", () => {
  it("exige un motif pour couper l'accès, pas pour le rétablir", () => {
    expect(needsReason("deactivate")).toBe(true);
    expect(needsReason("archive")).toBe(true);
    expect(needsReason("reactivate")).toBe(false);
  });
});
