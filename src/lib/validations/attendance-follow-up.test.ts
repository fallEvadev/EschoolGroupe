import { describe, expect, it } from "vitest";

import {
  closeDaySchema,
  excuseAbsenceSchema,
  reviewAttendanceSchema,
  validateDepartureSchema,
} from "./attendance-follow-up";

const id = "5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10";

describe("reviewAttendanceSchema", () => {
  it("accepte une validation sans commentaire", () => {
    expect(
      reviewAttendanceSchema.safeParse({
        attendanceId: id,
        decision: "valide",
        comment: "",
      }).success,
    ).toBe(true);
  });

  it("exige un motif pour refuser, et le nettoie", () => {
    expect(
      reviewAttendanceSchema.safeParse({
        attendanceId: id,
        decision: "refuse",
        comment: "  ",
      }).success,
    ).toBe(false);
    expect(
      reviewAttendanceSchema.parse({
        attendanceId: id,
        decision: "refuse",
        comment: "  Absent de l'école  ",
      }).comment,
    ).toBe("Absent de l'école");
  });

  it.each([
    { attendanceId: "abc", decision: "valide", comment: "" },
    { attendanceId: id, decision: "peut-etre", comment: "" },
    { attendanceId: id, decision: "refuse", comment: "x".repeat(501) },
  ])("refuse %j", (input) => {
    expect(reviewAttendanceSchema.safeParse(input).success).toBe(false);
  });
});

describe("excuseAbsenceSchema", () => {
  const valid = {
    profileId: id,
    slotId: id,
    date: "2026-10-07",
    reason: "  Malade, certificat médical  ",
  };

  it("accepte une excuse et nettoie le motif", () => {
    expect(excuseAbsenceSchema.parse(valid).reason).toBe(
      "Malade, certificat médical",
    );
  });

  it.each([
    { reason: "ab" },
    { reason: "  " },
    { date: "2026-02-30" },
    { date: "07/10/2026" },
    { profileId: "abc" },
    { slotId: "abc" },
  ])("refuse la valeur %j", (override) => {
    expect(
      excuseAbsenceSchema.safeParse({ ...valid, ...override }).success,
    ).toBe(false);
  });
});

describe("closeDaySchema", () => {
  const valid = { date: "2026-10-07", schoolId: null, reason: "Tabaski" };

  it("accepte toutes les écoles (école vide) ou une école", () => {
    expect(closeDaySchema.safeParse(valid).success).toBe(true);
    expect(closeDaySchema.safeParse({ ...valid, schoolId: id }).success).toBe(
      true,
    );
  });

  it("accepte une date future (jour férié prévu)", () => {
    expect(
      closeDaySchema.safeParse({ ...valid, date: "2027-04-04" }).success,
    ).toBe(true);
  });

  it.each([
    { reason: "" },
    { reason: "x".repeat(201) },
    { date: "2026-13-01" },
    { schoolId: "abc" },
  ])("refuse la valeur %j", (override) => {
    expect(closeDaySchema.safeParse({ ...valid, ...override }).success).toBe(
      false,
    );
  });
});

describe("validateDepartureSchema", () => {
  const valid = { attendanceId: id, reason: "Parti plus tôt avec accord" };

  it("accepte une descente sans heure réelle", () => {
    expect(validateDepartureSchema.safeParse(valid).success).toBe(true);
    expect(
      validateDepartureSchema.safeParse({ ...valid, departedTime: "" }).success,
    ).toBe(true);
  });

  it("accepte une heure réelle de départ valide", () => {
    for (const departedTime of ["12:00", "08:05", "23:59", " 12:00 "]) {
      expect(
        validateDepartureSchema.safeParse({ ...valid, departedTime }).success,
      ).toBe(true);
    }
  });

  it.each(["12h", "24:00", "12:60", "1:00", "midi", "12:00:00"])(
    "refuse l'heure %j",
    (departedTime) => {
      expect(
        validateDepartureSchema.safeParse({ ...valid, departedTime }).success,
      ).toBe(false);
    },
  );

  it("garde le motif obligatoire", () => {
    expect(
      validateDepartureSchema.safeParse({ ...valid, reason: "ab" }).success,
    ).toBe(false);
  });
});
