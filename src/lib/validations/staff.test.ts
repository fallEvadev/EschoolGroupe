import { describe, expect, it } from "vitest";

import { staffSchema } from "./staff";

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
