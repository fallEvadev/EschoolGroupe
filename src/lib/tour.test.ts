import { describe, expect, it } from "vitest";

import {
  computeBubblePosition,
  navTourId,
  progressLabel,
  tourStorageKey,
  tourSteps,
  type TourSpace,
} from "./tour";

const SPACES: TourSpace[] = ["formateur", "maintenance", "admin", "partenaire"];

describe("étapes du guide", () => {
  it.each(SPACES)(
    "l'espace %s a des étapes complètes et en français",
    (space) => {
      const steps = tourSteps(space);
      expect(steps.length).toBeGreaterThanOrEqual(4);
      for (const step of steps) {
        expect(step.title.length).toBeGreaterThan(2);
        expect(step.text.length).toBeGreaterThan(10);
        // Textes courts : la bulle doit rester lisible sur un téléphone.
        expect(step.text.length).toBeLessThanOrEqual(220);
      }
    },
  );

  it.each(SPACES)(
    "l'espace %s n'a pas deux étapes avec le même identifiant",
    (space) => {
      const ids = tourSteps(space).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it("chaque guide se termine par le bouton Aide", () => {
    for (const space of SPACES) {
      expect(tourSteps(space).at(-1)?.target).toBe("aide");
    }
  });

  it("les entrées de menu pointent des adresses réelles de leur espace", () => {
    const prefix: Record<TourSpace, string> = {
      formateur: "/formateur",
      maintenance: "/maintenance",
      admin: "/admin",
      partenaire: "/partenaire",
    };
    for (const space of SPACES) {
      for (const step of tourSteps(space)) {
        if (step.target?.startsWith("nav:")) {
          expect(step.target.startsWith(`nav:${prefix[space]}`)).toBe(true);
        }
      }
    }
  });

  it("dans l'administration, les pages réservées à un rôle sont facultatives", () => {
    const navSteps = tourSteps("admin").filter((s) =>
      s.target?.startsWith("nav:"),
    );
    expect(navSteps.length).toBeGreaterThan(5);
    expect(navSteps.every((s) => s.optional)).toBe(true);
  });

  it("l'administration ouvre le menu au début et le referme avant les boutons de l'en-tête", () => {
    const steps = tourSteps("admin");
    expect(steps[0]?.openMenu).toBe(true);
    expect(steps.find((s) => s.id === "cloche")?.closeMenu).toBe(true);
  });
});

describe("progressLabel", () => {
  it("affiche « Étape 2 sur 6 » (l'index part de 0)", () => {
    expect(progressLabel(1, 6)).toBe("Étape 2 sur 6");
    expect(progressLabel(0, 4)).toBe("Étape 1 sur 4");
  });
});

describe("clés et identifiants", () => {
  it("navTourId et tourStorageKey sont stables", () => {
    expect(navTourId("/formateur/planning")).toBe("nav:/formateur/planning");
    expect(tourStorageKey("admin")).toBe("eschool-guide-admin");
  });
});

describe("computeBubblePosition", () => {
  const viewport = { width: 390, height: 800 };
  const bubble = { width: 300, height: 180 };

  it("place la bulle sous l'élément quand il reste de la place", () => {
    const placement = computeBubblePosition({
      target: { top: 100, left: 20, width: 100, height: 44 },
      viewport,
      bubble,
    });
    expect(placement.side).toBe("below");
    expect(placement.top).toBe(100 + 44 + 56);
  });

  it("la place au-dessus pour un élément en bas de l'écran (barre du bas)", () => {
    const placement = computeBubblePosition({
      target: { top: 730, left: 150, width: 80, height: 56 },
      viewport,
      bubble,
    });
    expect(placement.side).toBe("above");
    expect(placement.top).toBe(730 - 56 - 180);
  });

  it("garde toujours la bulle entièrement dans l'écran, à gauche comme à droite", () => {
    const left = computeBubblePosition({
      target: { top: 100, left: 0, width: 40, height: 40 },
      viewport,
      bubble,
    });
    const right = computeBubblePosition({
      target: { top: 100, left: 360, width: 30, height: 40 },
      viewport,
      bubble,
    });
    expect(left.left).toBeGreaterThanOrEqual(12);
    expect(right.left + bubble.width).toBeLessThanOrEqual(viewport.width - 12);
  });

  it("centre la bulle quand il n'y a pas d'élément à montrer", () => {
    const placement = computeBubblePosition({ target: null, viewport, bubble });
    expect(placement.side).toBe("center");
    expect(placement.top).toBe((800 - 180) / 2);
    expect(placement.left).toBe((390 - 300) / 2);
  });

  it("reste dans l'écran même s'il n'y a de place ni dessus ni dessous", () => {
    const placement = computeBubblePosition({
      target: { top: 200, left: 100, width: 100, height: 300 },
      viewport: { width: 390, height: 520 },
      bubble,
    });
    expect(placement.top).toBeGreaterThanOrEqual(12);
    expect(placement.top + bubble.height).toBeLessThanOrEqual(520 - 12 + 0.01);
  });
});
