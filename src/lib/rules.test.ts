import { describe, expect, it } from "vitest";

import { canAccessPath } from "@/lib/auth/roles";

import { mustAcceptRules, staffMissingAcceptance } from "./rules";

describe("mustAcceptRules", () => {
  it("exige l'acceptation des formateurs et des maintenanciers", () => {
    expect(mustAcceptRules("formateur")).toBe(true);
    expect(mustAcceptRules("maintenancier")).toBe(true);
  });

  it("ne bloque ni les administrateurs ni les directeurs partenaires", () => {
    for (const role of [
      "directeur_partenaire",
      "admin_pedagogie",
      "admin_rh",
      "admin_maintenance",
      "super_admin",
    ] as const) {
      expect(mustAcceptRules(role)).toBe(false);
    }
  });

  it("ne bloque pas un utilisateur sans rôle", () => {
    expect(mustAcceptRules(null)).toBe(false);
  });
});

describe("staffMissingAcceptance", () => {
  const staff = [
    { id: "a", role: "formateur", status: "actif" },
    { id: "b", role: "maintenancier", status: "actif" },
    { id: "c", role: "formateur", status: "inactif" },
    { id: "d", role: "formateur", status: "invite" },
    { id: "e", role: "admin_rh", status: "actif" },
  ] as const;

  it("liste les comptes actifs concernés sans acceptation", () => {
    const missing = staffMissingAcceptance(staff, new Set(["a"]));
    expect(missing.map((p) => p.id)).toEqual(["b"]);
  });

  it("ignore les comptes inactifs, invités ou non concernés", () => {
    const missing = staffMissingAcceptance(staff, new Set());
    expect(missing.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("renvoie une liste vide quand tout le monde a accepté", () => {
    expect(staffMissingAcceptance(staff, new Set(["a", "b"]))).toEqual([]);
  });
});

describe("page de gestion du règlement", () => {
  it("est réservée à l'Admin RH et au Super-Admin", () => {
    expect(canAccessPath("admin_rh", "/admin/reglement")).toBe(true);
    expect(canAccessPath("super_admin", "/admin/reglement")).toBe(true);
    expect(canAccessPath("admin_pedagogie", "/admin/reglement")).toBe(false);
    expect(canAccessPath("formateur", "/admin/reglement")).toBe(false);
  });
});
