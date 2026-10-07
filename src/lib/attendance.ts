import { timeToMinutes } from "@/lib/schools";

/** Le pointage ouvre 30 minutes avant le début du créneau. */
export const OPEN_BEFORE_MINUTES = 30;

/** Codes faux autorisés avant blocage. */
export const MAX_FAILED_ATTEMPTS = 5;

/** Durée de blocage (et fenêtre de comptage des échecs), en minutes. */
export const LOCK_MINUTES = 15;

/** Statut d'un pointage (mêmes valeurs que la contrainte SQL `status`). */
export const ATTENDANCE_STATUSES = ["present", "retard", "a_verifier"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Présent",
  retard: "Retard",
  a_verifier: "À vérifier",
};

export const ATTENDANCE_BADGE: Record<
  AttendanceStatus,
  "success" | "warning" | "destructive"
> = {
  present: "success",
  retard: "warning",
  a_verifier: "destructive",
};

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

/** Résultat du contrôle de position (mêmes valeurs que la contrainte SQL). */
export const LOCATION_RESULTS = [
  "ok",
  "hors_rayon",
  "imprecise",
  "refusee",
  "indisponible",
  "ecole_sans_position",
] as const;

export type LocationResult = (typeof LOCATION_RESULTS)[number];

export function isLocationResult(value: string): value is LocationResult {
  return (LOCATION_RESULTS as readonly string[]).includes(value);
}

/** Position d'un point sur la Terre, en degrés. */
export type Coordinates = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distance à vol d'oiseau entre deux points (formule de haversine), en mètres. */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** « 07:30 » pour un nombre de minutes depuis minuit. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export type Timing =
  | { state: "too_early"; opensAtMinutes: number }
  | { state: "ended" }
  | { state: "open"; late: boolean; lateMinutes: number };

/**
 * Où en est-on par rapport au créneau ? Le pointage ouvre 30 min avant le
 * début et ferme à la fin. Dans la fenêtre : « à l'heure » jusqu'à début +
 * tolérance (inclus), ensuite « en retard » (minutes comptées depuis le début).
 */
export function evaluateTiming({
  nowMinutes,
  startsAt,
  endsAt,
  toleranceMinutes,
}: {
  nowMinutes: number;
  startsAt: string;
  endsAt: string;
  toleranceMinutes: number;
}): Timing {
  const start = timeToMinutes(startsAt);
  const end = timeToMinutes(endsAt);
  const opensAt = Math.max(0, start - OPEN_BEFORE_MINUTES);
  if (nowMinutes < opensAt) {
    return { state: "too_early", opensAtMinutes: opensAt };
  }
  if (nowMinutes >= end) return { state: "ended" };
  const late = nowMinutes > start + toleranceMinutes;
  return { state: "open", late, lateMinutes: late ? nowMinutes - start : 0 };
}

/** Message à afficher quand le pointage n'est pas possible à cette heure. */
export function timingMessage(timing: Timing): string | null {
  if (timing.state === "too_early") {
    return `Le pointage ouvre à ${formatMinutes(timing.opensAtMinutes)}.`;
  }
  if (timing.state === "ended") {
    return "Ce créneau est terminé. Contactez la Direction pédagogique.";
  }
  return null;
}

/** Position envoyée par le téléphone du formateur. */
export type DevicePosition =
  | { status: "ok"; latitude: number; longitude: number; accuracyM: number }
  | { status: "refusee" }
  | { status: "indisponible" };

/** Position et rayon de l'école. */
export type SchoolPosition = {
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
};

export type LocationEvaluation = {
  result: LocationResult;
  distanceM: number | null;
  accuracyM: number | null;
};

/**
 * Contrôle de position. Un pointage n'est jamais refusé à cause du GPS : au
 * pire il est « à vérifier ». Une précision supérieure au rayon ne permet pas
 * de conclure : le résultat est « imprécis » même si le point semble dedans.
 */
export function evaluateLocation(
  school: SchoolPosition,
  position: DevicePosition,
): LocationEvaluation {
  if (position.status !== "ok") {
    return { result: position.status, distanceM: null, accuracyM: null };
  }
  const accuracyM = Math.round(position.accuracyM);
  if (school.latitude === null || school.longitude === null) {
    return { result: "ecole_sans_position", distanceM: null, accuracyM };
  }
  const distanceM = Math.round(
    haversineMeters(
      { latitude: school.latitude, longitude: school.longitude },
      position,
    ),
  );
  if (position.accuracyM > school.radiusM) {
    return { result: "imprecise", distanceM, accuracyM };
  }
  if (distanceM > school.radiusM) {
    return { result: "hors_rayon", distanceM, accuracyM };
  }
  return { result: "ok", distanceM, accuracyM };
}

/** Statut final : position non confirmée → à vérifier ; sinon retard ou présent. */
export function decideStatus(
  location: LocationResult,
  late: boolean,
): AttendanceStatus {
  if (location !== "ok") return "a_verifier";
  return late ? "retard" : "present";
}

/** Phrase expliquant le contrôle de position au formateur. */
export function locationExplanation(
  evaluation: LocationEvaluation,
  radiusM: number,
): string | null {
  switch (evaluation.result) {
    case "ok":
      return null;
    case "hors_rayon":
      return `Vous semblez à ${evaluation.distanceM} m de l'école (rayon autorisé : ${radiusM} m). La Direction vérifiera votre présence.`;
    case "imprecise":
      return `Votre position est trop imprécise (± ${evaluation.accuracyM} m) pour être confirmée. La Direction vérifiera votre présence.`;
    case "refusee":
      return "La localisation est refusée sur votre téléphone : votre présence sera vérifiée par la Direction.";
    case "indisponible":
      return "Votre position n'a pas pu être relevée : votre présence sera vérifiée par la Direction.";
    case "ecole_sans_position":
      return "La position de l'école n'est pas encore renseignée : votre présence sera vérifiée par la Direction.";
  }
}

/**
 * Résumé du contrôle de position pour la Direction (liste des pointages) :
 * « Hors rayon : à 850 m de l'école (± 20 m) ».
 */
export function locationSummary({
  locationResult,
  distanceM,
  accuracyM,
}: {
  locationResult: LocationResult;
  distanceM: number | null;
  accuracyM: number | null;
}): string {
  const precision = accuracyM === null ? "" : ` (± ${accuracyM} m)`;
  switch (locationResult) {
    case "ok":
      return `Position confirmée, à ${distanceM ?? "?"} m de l'école${precision}`;
    case "hors_rayon":
      return `Hors rayon : à ${distanceM ?? "?"} m de l'école${precision}`;
    case "imprecise":
      return `Position trop imprécise${precision}`;
    case "refusee":
      return "Localisation refusée sur le téléphone";
    case "indisponible":
      return "Position non relevée (signal ou appareil)";
    case "ecole_sans_position":
      return "Position de l'école non renseignée";
  }
}

export type LockState =
  | { locked: false; remaining: number }
  | { locked: true; unlockAt: Date; minutesLeft: number };

/**
 * Limite des essais : à partir de 5 codes faux dans les 15 dernières minutes,
 * le pointage est bloqué jusqu'à ce que le plus ancien de ces échecs sorte de
 * la fenêtre. Les demandes faites pendant le blocage ne sont pas comptées.
 */
export function lockState(failureTimes: readonly Date[], now: Date): LockState {
  const windowMs = LOCK_MINUTES * 60_000;
  const recent = failureTimes
    .map((date) => date.getTime())
    .filter((time) => now.getTime() - time < windowMs)
    .sort((a, b) => a - b);
  if (recent.length < MAX_FAILED_ATTEMPTS) {
    return { locked: false, remaining: MAX_FAILED_ATTEMPTS - recent.length };
  }
  const unlockAt = new Date(
    (recent[recent.length - MAX_FAILED_ATTEMPTS] ?? now.getTime()) + windowMs,
  );
  return {
    locked: true,
    unlockAt,
    minutesLeft: Math.max(
      1,
      Math.ceil((unlockAt.getTime() - now.getTime()) / 60_000),
    ),
  };
}
