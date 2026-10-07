import { describe, expect, it } from "vitest";

import {
  decideStatus,
  evaluateLocation,
  evaluateTiming,
  formatMinutes,
  haversineMeters,
  LOCK_MINUTES,
  lockState,
  locationExplanation,
  MAX_FAILED_ATTEMPTS,
  timingMessage,
} from "./attendance";

describe("haversineMeters", () => {
  it("renvoie 0 pour un même point", () => {
    const point = { latitude: 14.6928, longitude: -17.4467 };
    expect(haversineMeters(point, point)).toBe(0);
  });

  it("mesure environ 111 km pour un degré de latitude", () => {
    const meters = haversineMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );
    expect(meters).toBeGreaterThan(111_000);
    expect(meters).toBeLessThan(111_400);
  });

  it("est symétrique", () => {
    const a = { latitude: 14.6928, longitude: -17.4467 };
    const b = { latitude: 16.0326, longitude: -16.4818 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });

  it("mesure une centaine de mètres à courte distance", () => {
    // ~0,0009° de latitude ≈ 100 m.
    const meters = haversineMeters(
      { latitude: 14.6928, longitude: -17.4467 },
      { latitude: 14.6937, longitude: -17.4467 },
    );
    expect(meters).toBeGreaterThan(95);
    expect(meters).toBeLessThan(105);
  });
});

describe("formatMinutes", () => {
  it("écrit hh:mm avec les zéros", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(450)).toBe("07:30");
    expect(formatMinutes(1439)).toBe("23:59");
  });
});

describe("evaluateTiming (créneau 08:00–10:00, tolérance 15 min)", () => {
  const slot = {
    startsAt: "08:00:00",
    endsAt: "10:00:00",
    toleranceMinutes: 15,
  };
  const at = (hours: number, minutes: number) =>
    evaluateTiming({ ...slot, nowMinutes: hours * 60 + minutes });

  it("refuse avant l'ouverture, 30 minutes avant le début", () => {
    expect(at(7, 29)).toEqual({ state: "too_early", opensAtMinutes: 450 });
  });

  it("ouvre à 07:30 et compte présent jusqu'à 08:15 inclus", () => {
    expect(at(7, 30)).toEqual({ state: "open", late: false, lateMinutes: 0 });
    expect(at(8, 0)).toEqual({ state: "open", late: false, lateMinutes: 0 });
    expect(at(8, 15)).toEqual({ state: "open", late: false, lateMinutes: 0 });
  });

  it("passe en retard dès 08:16, minutes comptées depuis le début", () => {
    expect(at(8, 16)).toEqual({ state: "open", late: true, lateMinutes: 16 });
    expect(at(9, 59)).toEqual({ state: "open", late: true, lateMinutes: 119 });
  });

  it("ferme à la fin du créneau", () => {
    expect(at(10, 0)).toEqual({ state: "ended" });
    expect(at(18, 30)).toEqual({ state: "ended" });
  });

  it("ne descend pas sous minuit pour un créneau très tôt", () => {
    expect(
      evaluateTiming({
        nowMinutes: 0,
        startsAt: "00:10",
        endsAt: "01:00",
        toleranceMinutes: 0,
      }),
    ).toEqual({ state: "open", late: false, lateMinutes: 0 });
  });

  it("accepte une tolérance nulle", () => {
    expect(
      evaluateTiming({ ...slot, toleranceMinutes: 0, nowMinutes: 8 * 60 + 1 }),
    ).toEqual({ state: "open", late: true, lateMinutes: 1 });
  });
});

describe("timingMessage", () => {
  it("explique pourquoi le pointage n'est pas possible", () => {
    expect(timingMessage({ state: "too_early", opensAtMinutes: 450 })).toBe(
      "Le pointage ouvre à 07:30.",
    );
    expect(timingMessage({ state: "ended" })).toContain("terminé");
  });

  it("ne dit rien quand le pointage est ouvert", () => {
    expect(
      timingMessage({ state: "open", late: false, lateMinutes: 0 }),
    ).toBeNull();
  });
});

describe("evaluateLocation", () => {
  const school = { latitude: 14.6928, longitude: -17.4467, radiusM: 150 };
  const near = { latitude: 14.6933, longitude: -17.4467 }; // ~55 m
  const far = { latitude: 14.7028, longitude: -17.4467 }; // ~1,1 km

  it("confirme une position dans le rayon, avec une bonne précision", () => {
    const result = evaluateLocation(school, {
      status: "ok",
      ...near,
      accuracyM: 20,
    });
    expect(result.result).toBe("ok");
    expect(result.distanceM).toBeGreaterThan(40);
    expect(result.distanceM).toBeLessThan(70);
    expect(result.accuracyM).toBe(20);
  });

  it("signale une position hors du rayon", () => {
    const result = evaluateLocation(school, {
      status: "ok",
      ...far,
      accuracyM: 20,
    });
    expect(result.result).toBe("hors_rayon");
    expect(result.distanceM).toBeGreaterThan(1000);
  });

  it("signale une précision supérieure au rayon, même si le point semble dedans", () => {
    const result = evaluateLocation(school, {
      status: "ok",
      ...near,
      accuracyM: 400,
    });
    expect(result.result).toBe("imprecise");
  });

  it("accepte une précision égale au rayon", () => {
    const result = evaluateLocation(school, {
      status: "ok",
      ...near,
      accuracyM: 150,
    });
    expect(result.result).toBe("ok");
  });

  it("renvoie le motif quand le téléphone ne donne pas de position", () => {
    expect(evaluateLocation(school, { status: "refusee" })).toEqual({
      result: "refusee",
      distanceM: null,
      accuracyM: null,
    });
    expect(evaluateLocation(school, { status: "indisponible" }).result).toBe(
      "indisponible",
    );
  });

  it("signale une école sans position renseignée", () => {
    const result = evaluateLocation(
      { latitude: null, longitude: null, radiusM: 150 },
      { status: "ok", ...near, accuracyM: 20 },
    );
    expect(result.result).toBe("ecole_sans_position");
    expect(result.distanceM).toBeNull();
  });
});

describe("decideStatus", () => {
  it("met à vérifier toute position non confirmée, même en retard", () => {
    expect(decideStatus("hors_rayon", false)).toBe("a_verifier");
    expect(decideStatus("refusee", true)).toBe("a_verifier");
    expect(decideStatus("ecole_sans_position", false)).toBe("a_verifier");
  });

  it("distingue présent et retard quand la position est confirmée", () => {
    expect(decideStatus("ok", false)).toBe("present");
    expect(decideStatus("ok", true)).toBe("retard");
  });
});

describe("locationExplanation", () => {
  it("ne dit rien quand la position est confirmée", () => {
    expect(
      locationExplanation({ result: "ok", distanceM: 30, accuracyM: 10 }, 150),
    ).toBeNull();
  });

  it("donne la distance et le rayon pour un pointage hors rayon", () => {
    const text = locationExplanation(
      { result: "hors_rayon", distanceM: 850, accuracyM: 20 },
      150,
    );
    expect(text).toContain("850 m");
    expect(text).toContain("150 m");
  });

  it("explique chaque autre cas", () => {
    for (const result of [
      "imprecise",
      "refusee",
      "indisponible",
      "ecole_sans_position",
    ] as const) {
      expect(
        locationExplanation({ result, distanceM: null, accuracyM: 300 }, 150),
      ).toContain("vérifi");
    }
  });
});

describe("lockState", () => {
  const now = new Date("2026-10-07T08:00:00Z");
  const minutesAgo = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000);

  it("autorise les premiers essais et compte ceux qui restent", () => {
    expect(lockState([], now)).toEqual({
      locked: false,
      remaining: MAX_FAILED_ATTEMPTS,
    });
    expect(lockState([minutesAgo(1), minutesAgo(2)], now)).toEqual({
      locked: false,
      remaining: MAX_FAILED_ATTEMPTS - 2,
    });
  });

  it("bloque après 5 échecs dans les 15 dernières minutes", () => {
    const failures = [1, 2, 3, 4, 5].map(minutesAgo);
    const state = lockState(failures, now);
    expect(state.locked).toBe(true);
    if (state.locked) {
      // Le plus ancien échec (il y a 5 min) sort de la fenêtre dans 10 min.
      expect(state.minutesLeft).toBe(LOCK_MINUTES - 5);
      expect(state.unlockAt.getTime()).toBe(
        minutesAgo(5).getTime() + LOCK_MINUTES * 60_000,
      );
    }
  });

  it("ignore les échecs plus anciens que la fenêtre", () => {
    // L'échec d'il y a 16 minutes ne compte plus : il en reste 4 sur 5.
    const failures = [1, 2, 3, 4, 16].map(minutesAgo);
    expect(lockState(failures, now)).toEqual({ locked: false, remaining: 1 });
  });

  it("débloque dès que l'échec le plus ancien sort de la fenêtre", () => {
    const failures = [15, 4, 3, 2, 1].map(minutesAgo);
    expect(lockState(failures, now)).toEqual({ locked: false, remaining: 1 });
  });

  it("garde le blocage tant que 5 échecs restent dans la fenêtre", () => {
    // 6 échecs : il faut que les deux plus anciens sortent de la fenêtre. Le
    // second (il y a 12 min) en sortira dans 3 min, et c'est lui qui débloque.
    const failures = [14, 12, 10, 8, 6, 4].map(minutesAgo);
    const state = lockState(failures, now);
    expect(state.locked).toBe(true);
    if (state.locked) expect(state.minutesLeft).toBe(3);
  });
});
