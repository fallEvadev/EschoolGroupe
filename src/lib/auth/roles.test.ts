import { describe, expect, it } from "vitest";

import {
  assignableRoles,
  canAccess,
  canAccessPath,
  homeForRole,
  parseRole,
  ROLES,
  spaceForPath,
  SPACES,
  type Role,
  type SpaceKey,
} from "./roles";

describe("parseRole", () => {
  it("accepte les 7 rôles connus", () => {
    for (const role of ROLES) expect(parseRole(role)).toBe(role);
  });

  it("refuse toute autre valeur", () => {
    for (const value of ["admin", "SUPER_ADMIN", "", null, undefined, 42]) {
      expect(parseRole(value)).toBeNull();
    }
  });
});

describe("spaceForPath", () => {
  it("reconnaît chaque espace et ses sous-pages", () => {
    expect(spaceForPath("/admin")).toBe("admin");
    expect(spaceForPath("/admin/parametres")).toBe("admin");
    expect(spaceForPath("/formateur")).toBe("formateur");
    expect(spaceForPath("/maintenance/tickets")).toBe("maintenance");
    expect(spaceForPath("/partenaire")).toBe("partenaire");
  });

  it("ne confond pas un préfixe avec un autre chemin", () => {
    expect(spaceForPath("/administration")).toBeNull();
    expect(spaceForPath("/")).toBeNull();
  });
});

describe("canAccess", () => {
  /** Matrice attendue : qui entre dans quel espace. */
  const expected: Record<Role, SpaceKey[]> = {
    formateur: ["formateur"],
    maintenancier: ["maintenance"],
    directeur_partenaire: ["partenaire"],
    admin_pedagogie: ["admin"],
    admin_rh: ["admin"],
    admin_maintenance: ["maintenance", "admin"],
    super_admin: ["formateur", "maintenance", "partenaire", "admin"],
  };

  for (const role of ROLES) {
    it(`${role} n'entre que dans ses espaces`, () => {
      for (const space of Object.keys(SPACES) as SpaceKey[]) {
        expect(canAccess(role, space)).toBe(expected[role].includes(space));
      }
    });
  }

  it("refuse un utilisateur sans rôle", () => {
    expect(canAccess(null, "formateur")).toBe(false);
  });
});

describe("canAccessPath", () => {
  for (const path of ["/admin/acces", "/admin/parametres"]) {
    it(`réserve ${path} au Super-Admin`, () => {
      expect(canAccessPath("super_admin", path)).toBe(true);
      for (const role of ROLES.filter((r) => r !== "super_admin")) {
        expect(canAccessPath(role, path)).toBe(false);
      }
      expect(canAccessPath(null, path)).toBe(false);
    });
  }

  it("réserve /admin/personnel à l'Admin RH et au Super-Admin", () => {
    for (const role of ROLES) {
      expect(canAccessPath(role, "/admin/personnel/nouveau")).toBe(
        role === "admin_rh" || role === "super_admin",
      );
    }
  });

  it("laisse passer les pages sans restriction particulière", () => {
    expect(canAccessPath("admin_rh", "/admin")).toBe(true);
  });
});

describe("homeForRole", () => {
  it("envoie chaque rôle vers un espace qu'il peut ouvrir", () => {
    for (const role of ROLES) {
      const space = spaceForPath(homeForRole(role));
      expect(space).not.toBeNull();
      expect(canAccess(role, space as SpaceKey)).toBe(true);
    }
  });
});

describe("assignableRoles", () => {
  it("donne tous les rôles au Super-Admin", () => {
    expect(assignableRoles("super_admin")).toEqual(ROLES);
  });

  it("limite l'Admin RH aux rôles non administrateurs", () => {
    expect(assignableRoles("admin_rh")).toEqual([
      "formateur",
      "maintenancier",
      "directeur_partenaire",
    ]);
  });

  it("ne donne rien aux autres rôles", () => {
    expect(assignableRoles("admin_pedagogie")).toEqual([]);
    expect(assignableRoles(null)).toEqual([]);
  });
});
