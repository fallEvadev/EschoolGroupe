import { describe, expect, it } from "vitest";

import { staffSchema, staffStatusSchema } from "./staff";

const valid = {
  firstName: " Babacar ",
  lastName: "Ndiaye",
  email: "Babacar.Ndiaye@Exemple.sn",
  phone: "77 123 45 67",
  role: "formateur",
  jobTitle: "Développement web",
  contractType: "vacataire",
  hireDate: "2026-09-01",
};

describe("staffSchema", () => {
  it("nettoie une fiche correcte", () => {
    expect(staffSchema.parse(valid)).toEqual({
      firstName: "Babacar",
      lastName: "Ndiaye",
      email: "babacar.ndiaye@exemple.sn",
      phone: "771234567",
      role: "formateur",
      jobTitle: "Développement web",
      contractType: "vacataire",
      hireDate: "2026-09-01",
    });
  });

  it("transforme les champs facultatifs vides en null", () => {
    const parsed = staffSchema.parse({
      ...valid,
      phone: "",
      jobTitle: "  ",
      contractType: "",
      hireDate: "",
    });
    expect(parsed.phone).toBeNull();
    expect(parsed.jobTitle).toBeNull();
    expect(parsed.contractType).toBeNull();
    expect(parsed.hireDate).toBeNull();
  });

  it.each(["+221 77 123 45 67", "00221771234567", "33-812-34-56"])(
    "accepte le numéro %s",
    (phone) => {
      expect(staffSchema.safeParse({ ...valid, phone }).success).toBe(true);
    },
  );

  it.each(["12345", "+33 6 12 34 56 78", "87 123 45 67"])(
    "refuse le numéro %s",
    (phone) => {
      expect(staffSchema.safeParse({ ...valid, phone }).success).toBe(false);
    },
  );

  it.each([
    ["email", "pas-un-email"],
    ["firstName", "  "],
    ["role", "directeur"],
    ["contractType", "freelance"],
    ["hireDate", "01/09/2026"],
  ])("refuse %s = « %s »", (field, value) => {
    expect(staffSchema.safeParse({ ...valid, [field]: value }).success).toBe(
      false,
    );
  });
});

describe("staffStatusSchema", () => {
  const base = {
    profileId: "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10",
    action: "deactivate",
    reason: "  Fin de contrat  ",
  };

  it("accepte une désactivation avec motif et nettoie le motif", () => {
    expect(staffStatusSchema.parse(base).reason).toBe("Fin de contrat");
  });

  it("exige un motif pour désactiver ou archiver", () => {
    for (const action of ["deactivate", "archive"]) {
      expect(
        staffStatusSchema.safeParse({ ...base, action, reason: " " }).success,
      ).toBe(false);
    }
  });

  it("n'exige pas de motif pour réactiver", () => {
    expect(
      staffStatusSchema.safeParse({ ...base, action: "reactivate", reason: "" })
        .success,
    ).toBe(true);
  });

  it("refuse une action inconnue, une fiche invalide ou un motif trop long", () => {
    expect(
      staffStatusSchema.safeParse({ ...base, action: "supprimer" }).success,
    ).toBe(false);
    expect(
      staffStatusSchema.safeParse({ ...base, profileId: "abc" }).success,
    ).toBe(false);
    expect(
      staffStatusSchema.safeParse({ ...base, reason: "x".repeat(501) }).success,
    ).toBe(false);
  });
});
