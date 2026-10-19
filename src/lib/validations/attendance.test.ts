import { describe, expect, it } from "vitest";

import { attendanceSchema, departureSchema } from "./attendance";

const valid = {
  slotId: "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10",
  position: {
    status: "ok",
    latitude: 14.6928,
    longitude: -17.4467,
    accuracyM: 18.5,
  },
};

describe("attendanceSchema", () => {
  it("accepte un pointage avec position", () => {
    expect(attendanceSchema.safeParse(valid).success).toBe(true);
  });

  it("accepte une position refusée ou indisponible", () => {
    for (const status of ["refusee", "indisponible"]) {
      expect(
        attendanceSchema.safeParse({ ...valid, position: { status } }).success,
      ).toBe(true);
    }
  });

  it("refuse un créneau qui n'est pas un identifiant", () => {
    expect(
      attendanceSchema.safeParse({ ...valid, slotId: "abc" }).success,
    ).toBe(false);
  });

  it.each([
    { status: "ok", latitude: 91, longitude: 0, accuracyM: 10 },
    { status: "ok", latitude: 0, longitude: -181, accuracyM: 10 },
    { status: "ok", latitude: 0, longitude: 0, accuracyM: -1 },
    { status: "ok", latitude: "14.6", longitude: 0, accuracyM: 10 },
    { status: "ok", latitude: 14.6, longitude: 0 },
    { status: "inconnu" },
    {},
  ])("refuse la position invalide %j", (position) => {
    expect(attendanceSchema.safeParse({ ...valid, position }).success).toBe(
      false,
    );
  });

  it("n'accepte aucun champ désignant le formateur", () => {
    // Un champ supplémentaire est ignoré : l'identité vient du jeton.
    const parsed = attendanceSchema.parse({
      ...valid,
      profileId: "autre-personne",
    });
    expect("profileId" in parsed).toBe(false);
  });
});

describe("attendanceSchema : arrivée sans code", () => {
  it("ignore un code envoyé à l'arrivée", () => {
    const parsed = attendanceSchema.parse({ ...valid, code: "123456" });
    expect("code" in parsed).toBe(false);
  });
});

describe("departureSchema", () => {
  const ok = {
    attendanceId: "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10",
    code: "428105",
  };

  it("accepte un pointage et un code à 6 chiffres", () => {
    expect(departureSchema.safeParse(ok).success).toBe(true);
  });

  it("nettoie les espaces autour du code", () => {
    expect(departureSchema.parse({ ...ok, code: " 004281 " }).code).toBe(
      "004281",
    );
  });

  it.each(["12345", "1234567", "12345a", "12 345", "", "abcdef"])(
    "refuse le code « %s »",
    (code) => {
      expect(departureSchema.safeParse({ ...ok, code }).success).toBe(false);
    },
  );

  it("refuse un pointage qui n'est pas un identifiant", () => {
    expect(
      departureSchema.safeParse({ ...ok, attendanceId: "abc" }).success,
    ).toBe(false);
  });

  it("n'accepte aucun champ désignant le formateur", () => {
    const parsed = departureSchema.parse({ ...ok, profileId: "autre" });
    expect("profileId" in parsed).toBe(false);
  });
});
