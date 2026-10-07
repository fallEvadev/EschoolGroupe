import { describe, expect, it } from "vitest";

import {
  assignmentSchema,
  directorPositionSchema,
  schoolPositionSchema,
  schoolSchema,
  slotSchema,
} from "./schools";

const valid = {
  name: "  Campus Dakar-Plateau ",
  address: "  Avenue Léopold Sédar Senghor ",
  lateToleranceMinutes: 15,
};

describe("schoolSchema", () => {
  it("nettoie une école correcte", () => {
    expect(schoolSchema.parse(valid)).toEqual({
      name: "Campus Dakar-Plateau",
      address: "Avenue Léopold Sédar Senghor",
      lateToleranceMinutes: 15,
    });
  });

  it("transforme l'adresse vide en null", () => {
    expect(schoolSchema.parse({ ...valid, address: "  " }).address).toBeNull();
  });

  it("ne contient plus ni position ni rayon : ils sont ignorés s'ils sont envoyés", () => {
    // Une modification du nom ne doit jamais pouvoir écraser la position
    // enregistrée par le directeur, ni changer le rayon.
    const parsed = schoolSchema.parse({
      ...valid,
      latitude: "14.6928",
      longitude: "-17.4467",
      radiusM: 5000,
    });
    expect("latitude" in parsed).toBe(false);
    expect("longitude" in parsed).toBe(false);
    expect("radiusM" in parsed).toBe(false);
  });

  it.each([
    ["name", " a "],
    ["name", "x".repeat(121)],
    ["lateToleranceMinutes", -1],
    ["lateToleranceMinutes", 181],
    ["lateToleranceMinutes", 1.5],
    ["lateToleranceMinutes", Number.NaN],
  ])("refuse %s = %s", (field, value) => {
    expect(schoolSchema.safeParse({ ...valid, [field]: value }).success).toBe(
      false,
    );
  });
});

describe("schoolPositionSchema (saisie manuelle de secours)", () => {
  const schoolId = "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10";

  it("accepte des coordonnées, virgule décimale comprise", () => {
    expect(
      schoolPositionSchema.parse({
        schoolId,
        latitude: "14,6928",
        longitude: "-17.4467",
      }),
    ).toEqual({ schoolId, latitude: 14.6928, longitude: -17.4467 });
  });

  it.each([
    { latitude: "" },
    { longitude: "" },
    { latitude: "91" },
    { latitude: "abc" },
    { longitude: "-181" },
    { schoolId: "abc" },
  ])("refuse %j", (override) => {
    expect(
      schoolPositionSchema.safeParse({
        schoolId,
        latitude: "14.6928",
        longitude: "-17.4467",
        ...override,
      }).success,
    ).toBe(false);
  });
});

describe("directorPositionSchema (position relevée par le téléphone)", () => {
  const valid = {
    schoolId: "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10",
    latitude: 14.6928,
    longitude: -17.4467,
    accuracyM: 18,
  };

  it("accepte une position relevée", () => {
    expect(directorPositionSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    { latitude: 91 },
    { longitude: -181 },
    { accuracyM: -1 },
    { latitude: "14.6" },
    { latitude: undefined },
    { schoolId: "abc" },
  ])("refuse %j", (override) => {
    expect(
      directorPositionSchema.safeParse({ ...valid, ...override }).success,
    ).toBe(false);
  });
});

describe("slotSchema", () => {
  const slot = {
    schoolId: "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10",
    weekday: 1,
    startsAt: "08:00",
    endsAt: "10:00",
    label: "  Matin ",
  };

  it("accepte un créneau correct et nettoie le libellé", () => {
    expect(slotSchema.parse(slot).label).toBe("Matin");
    expect(slotSchema.parse({ ...slot, label: "" }).label).toBeNull();
  });

  it("refuse une fin qui n'est pas après le début", () => {
    expect(slotSchema.safeParse({ ...slot, endsAt: "08:00" }).success).toBe(
      false,
    );
    expect(slotSchema.safeParse({ ...slot, endsAt: "07:00" }).success).toBe(
      false,
    );
  });

  it.each([
    ["weekday", 0],
    ["weekday", 8],
    ["weekday", 1.5],
    ["startsAt", "8:00"],
    ["startsAt", "25:00"],
    ["endsAt", "10:60"],
    ["schoolId", "abc"],
  ])("refuse %s = %s", (field, value) => {
    expect(slotSchema.safeParse({ ...slot, [field]: value }).success).toBe(
      false,
    );
  });
});

describe("assignmentSchema", () => {
  it("exige deux identifiants valides", () => {
    const id = "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10";
    expect(
      assignmentSchema.safeParse({ slotId: id, profileId: id }).success,
    ).toBe(true);
    expect(
      assignmentSchema.safeParse({ slotId: "x", profileId: id }).success,
    ).toBe(false);
  });
});
