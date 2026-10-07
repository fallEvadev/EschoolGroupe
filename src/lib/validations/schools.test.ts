import { describe, expect, it } from "vitest";

import { assignmentSchema, schoolSchema, slotSchema } from "./schools";

const valid = {
  name: "  Campus Dakar-Plateau ",
  address: "  Avenue Léopold Sédar Senghor ",
  latitude: "14,6928",
  longitude: "-17.4467",
  radiusM: 150,
  lateToleranceMinutes: 15,
};

describe("schoolSchema", () => {
  it("nettoie une école correcte (virgule décimale acceptée)", () => {
    expect(schoolSchema.parse(valid)).toEqual({
      name: "Campus Dakar-Plateau",
      address: "Avenue Léopold Sédar Senghor",
      latitude: 14.6928,
      longitude: -17.4467,
      radiusM: 150,
      lateToleranceMinutes: 15,
    });
  });

  it("transforme l'adresse vide en null", () => {
    expect(schoolSchema.parse({ ...valid, address: "  " }).address).toBeNull();
  });

  it("accepte une école sans position", () => {
    const parsed = schoolSchema.parse({
      ...valid,
      latitude: "",
      longitude: "",
    });
    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  it("refuse une seule coordonnée renseignée", () => {
    expect(schoolSchema.safeParse({ ...valid, longitude: "" }).success).toBe(
      false,
    );
    expect(schoolSchema.safeParse({ ...valid, latitude: "" }).success).toBe(
      false,
    );
  });

  it.each([
    ["latitude", "91"],
    ["latitude", "abc"],
    ["longitude", "-181"],
    ["name", " a "],
    ["radiusM", 10],
    ["radiusM", 6000],
    ["radiusM", 150.5],
    ["radiusM", Number.NaN],
    ["lateToleranceMinutes", -1],
    ["lateToleranceMinutes", 181],
  ])("refuse %s = %s", (field, value) => {
    expect(schoolSchema.safeParse({ ...valid, [field]: value }).success).toBe(
      false,
    );
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
