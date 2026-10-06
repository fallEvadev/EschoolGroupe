import { describe, expect, it } from "vitest";

import { resolveAppUrl } from "./app-url";

describe("resolveAppUrl", () => {
  it("préfère l'adresse configurée aux en-têtes de la requête", () => {
    expect(
      resolveAppUrl({
        configured: "https://plateforme.eschool.sn",
        host: "pirate.example.com",
        forwardedProto: "https",
      }),
    ).toBe("https://plateforme.eschool.sn");
  });

  it("retire la barre finale et le chemin de l'adresse configurée", () => {
    expect(
      resolveAppUrl({ configured: "https://plateforme.eschool.sn/admin/" }),
    ).toBe("https://plateforme.eschool.sn");
  });

  it("ignore une adresse configurée invalide ou non http(s)", () => {
    for (const configured of ["pas une adresse", "javascript:alert(1)", " "]) {
      expect(resolveAppUrl({ configured, host: "localhost:3000" })).toBe(
        "https://localhost:3000",
      );
    }
  });

  it("reconstruit l'adresse depuis les en-têtes à défaut de configuration", () => {
    expect(
      resolveAppUrl({ host: "localhost:3000", forwardedProto: "http" }),
    ).toBe("http://localhost:3000");
    expect(resolveAppUrl({ host: "eschool.sn" })).toBe("https://eschool.sn");
  });

  it("échoue si aucune adresse n'est disponible", () => {
    expect(() => resolveAppUrl({})).toThrow();
  });
});
