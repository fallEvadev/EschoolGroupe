import { describe, expect, it } from "vitest";

import { getDevicePosition, mapGeolocationError } from "./geolocation";

describe("mapGeolocationError", () => {
  it("distingue le refus de l'utilisateur des autres échecs", () => {
    expect(mapGeolocationError(1)).toBe("refusee");
    expect(mapGeolocationError(2)).toBe("indisponible"); // signal introuvable
    expect(mapGeolocationError(3)).toBe("indisponible"); // délai dépassé
  });
});

describe("getDevicePosition", () => {
  it("renvoie « indisponible » sans planter quand le navigateur n'a pas de géolocalisation", async () => {
    // Environnement Node : pas de navigator.geolocation.
    await expect(getDevicePosition()).resolves.toEqual({
      status: "indisponible",
    });
  });
});
