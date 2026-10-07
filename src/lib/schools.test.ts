import { describe, expect, it } from "vitest";

import { canAccessPath } from "@/lib/auth/roles";

import {
  findOverlap,
  formatSlot,
  formatTime,
  isWeekday,
  mapsUrl,
  slotsOverlap,
  timeToMinutes,
} from "./schools";

describe("formatTime et timeToMinutes", () => {
  it("retire les secondes du format de la base", () => {
    expect(formatTime("08:00:00")).toBe("08:00");
    expect(formatTime("14:30")).toBe("14:30");
  });

  it("convertit une heure en minutes depuis minuit", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("08:30")).toBe(510);
    expect(timeToMinutes("14:05:00")).toBe(845);
  });
});

describe("isWeekday", () => {
  it("accepte 1 à 7 et refuse le reste", () => {
    expect(isWeekday(1)).toBe(true);
    expect(isWeekday(7)).toBe(true);
    expect(isWeekday(0)).toBe(false);
    expect(isWeekday(8)).toBe(false);
  });
});

describe("slotsOverlap", () => {
  const monday = { weekday: 1, startsAt: "08:00", endsAt: "10:00" };

  it("détecte un chevauchement le même jour", () => {
    expect(
      slotsOverlap(monday, { ...monday, startsAt: "09:00", endsAt: "11:00" }),
    ).toBe(true);
    expect(
      slotsOverlap(monday, { ...monday, startsAt: "07:00", endsAt: "08:30" }),
    ).toBe(true);
    expect(
      slotsOverlap(monday, { ...monday, startsAt: "08:30", endsAt: "09:00" }),
    ).toBe(true);
  });

  it("accepte deux créneaux bout à bout", () => {
    expect(
      slotsOverlap(monday, { ...monday, startsAt: "10:00", endsAt: "12:00" }),
    ).toBe(false);
    expect(
      slotsOverlap(monday, { ...monday, startsAt: "06:00", endsAt: "08:00" }),
    ).toBe(false);
  });

  it("ne confond pas deux jours différents", () => {
    expect(slotsOverlap(monday, { ...monday, weekday: 2 })).toBe(false);
  });

  it("compare les heures avec ou sans secondes", () => {
    expect(
      slotsOverlap(monday, {
        weekday: 1,
        startsAt: "09:00:00",
        endsAt: "09:30:00",
      }),
    ).toBe(true);
  });
});

describe("findOverlap", () => {
  const existing = [
    { weekday: 1, startsAt: "08:00", endsAt: "10:00", label: "Matin" },
    { weekday: 1, startsAt: "14:00", endsAt: "16:00", label: null },
  ];

  it("renvoie le créneau en conflit", () => {
    expect(
      findOverlap({ weekday: 1, startsAt: "09:00", endsAt: "09:30" }, existing),
    ).toBe(existing[0]);
  });

  it("renvoie null quand il n'y a pas de conflit", () => {
    expect(
      findOverlap({ weekday: 1, startsAt: "10:00", endsAt: "14:00" }, existing),
    ).toBeNull();
    expect(
      findOverlap({ weekday: 3, startsAt: "08:00", endsAt: "10:00" }, []),
    ).toBeNull();
  });
});

describe("formatSlot", () => {
  it("affiche le jour et les heures, avec le libellé s'il existe", () => {
    expect(
      formatSlot({ weekday: 1, startsAt: "08:00:00", endsAt: "10:00:00" }),
    ).toBe("Lundi · 08:00–10:00");
    expect(
      formatSlot({
        weekday: 5,
        startsAt: "14:00",
        endsAt: "16:30",
        label: "Après-midi",
      }),
    ).toBe("Vendredi · 14:00–16:30 (Après-midi)");
  });
});

describe("mapsUrl", () => {
  it("construit un lien de carte avec les coordonnées", () => {
    expect(mapsUrl(16.0326, -16.4818)).toBe(
      "https://www.google.com/maps?q=16.0326,-16.4818",
    );
  });
});

describe("page Écoles", () => {
  it("est réservée à l'Admin Pédagogie et au Super-Admin", () => {
    expect(canAccessPath("admin_pedagogie", "/admin/ecoles")).toBe(true);
    expect(canAccessPath("super_admin", "/admin/ecoles/nouveau")).toBe(true);
    expect(canAccessPath("admin_rh", "/admin/ecoles")).toBe(false);
    expect(canAccessPath("admin_maintenance", "/admin/ecoles")).toBe(false);
    expect(canAccessPath("formateur", "/admin/ecoles")).toBe(false);
  });
});
