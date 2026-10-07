import { timeToMinutes } from "@/lib/schools";

/** Le pointage ouvre 30 minutes avant le début du créneau. */
export const OPEN_BEFORE_MINUTES = 30;

/**
 * Codes faux autorisés avant blocage. Même valeur que `v_max` dans la fonction
 * SQL `verify_attendance_code` : les deux doivent changer ensemble.
 */
export const MAX_FAILED_ATTEMPTS = 5;

/**
 * Durée de blocage (et fenêtre de comptage des échecs), en minutes. Même valeur
 * que `v_window` dans la fonction SQL `verify_attendance_code`.
 */
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

/**
 * Message affiché au formateur quand son téléphone ne donne pas sa position,
 * avant d'envoyer le pointage : il peut réessayer (après avoir corrigé le
 * réglage) ou pointer quand même, auquel cas sa présence sera vérifiée.
 */
export function locationProblemMessage(
  reason: "refusee" | "indisponible",
): string {
  return reason === "refusee"
    ? "La localisation est refusée sur votre téléphone. Autorisez-la dans les réglages du navigateur (le cadenas à côté de l'adresse), puis touchez « Réessayer ». Vous pouvez aussi pointer sans position : votre présence sera alors vérifiée par la Direction."
    : "Votre position n'a pas pu être relevée (signal GPS introuvable ou délai dépassé). Sortez à l'extérieur, vérifiez que le GPS est activé, puis touchez « Réessayer ». Vous pouvez aussi pointer sans position : votre présence sera alors vérifiée par la Direction.";
}

/**
 * Précision maximale (mètres) acceptée quand le directeur enregistre la
 * position de l'école. Même valeur que le contrôle de la fonction SQL
 * `set_school_position` : les deux doivent changer ensemble.
 */
export const MAX_SCHOOL_POSITION_ACCURACY_M = 100;

export type SchoolPositionCheck =
  | { ok: true; latitude: number; longitude: number; accuracyM: number }
  | { ok: false; message: string };

/**
 * La position relevée par le téléphone du directeur peut-elle devenir la
 * position de l'école ? Elle sert ensuite de référence à tous les pointages :
 * on exige donc une position réelle et précise.
 */
export function checkSchoolPosition(
  position: DevicePosition,
): SchoolPositionCheck {
  if (position.status === "refusee") {
    return {
      ok: false,
      message:
        "La localisation est refusée sur votre téléphone. Autorisez-la dans les réglages du navigateur, puis réessayez.",
    };
  }
  if (position.status === "indisponible") {
    return {
      ok: false,
      message:
        "Votre position n'a pas pu être relevée. Sortez à l'extérieur, vérifiez que le GPS est activé, puis réessayez.",
    };
  }
  const accuracyM = Math.round(position.accuracyM);
  if (accuracyM > MAX_SCHOOL_POSITION_ACCURACY_M) {
    return {
      ok: false,
      message: `Position trop imprécise (± ${accuracyM} m, ${MAX_SCHOOL_POSITION_ACCURACY_M} m maximum). Sortez à l'extérieur, attendez quelques secondes, puis réessayez.`,
    };
  }
  return {
    ok: true,
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyM,
  };
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

/** Résultat du contrôle du code, renvoyé par `verify_attendance_code`. */
export const CODE_OUTCOMES = ["ok", "wrong", "locked", "no_code"] as const;

export type CodeOutcome = (typeof CODE_OUTCOMES)[number];

export function isCodeOutcome(value: string): value is CodeOutcome {
  return (CODE_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Message à afficher quand le code n'est pas accepté, ou `null` s'il l'est.
 * `remaining` : essais restants après celui-ci ; `minutesLeft` : durée du
 * blocage restante.
 */
export function codeOutcomeMessage(
  outcome: CodeOutcome,
  { remaining, minutesLeft }: { remaining: number; minutesLeft: number },
): string | null {
  switch (outcome) {
    case "ok":
      return null;
    case "locked":
      return `Trop de codes incorrects. Réessayez dans ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}.`;
    case "no_code":
      return "Le code du jour n'a pas encore été généré pour cette école. Contactez la Direction pédagogique.";
    case "wrong":
      return remaining > 0
        ? `Code incorrect. Il vous reste ${remaining} tentative${remaining > 1 ? "s" : ""}.`
        : `Code incorrect. Pointage bloqué pendant ${LOCK_MINUTES} minutes après ${MAX_FAILED_ATTEMPTS} essais.`;
  }
}

export type LockState =
  | { locked: false; remaining: number }
  | { locked: true; unlockAt: Date; minutesLeft: number };

/**
 * Règle de référence de la limite des essais : à partir de 5 codes faux dans
 * les 15 dernières minutes, le pointage est bloqué jusqu'à ce que le plus
 * ancien de ces échecs sorte de la fenêtre. Les demandes faites pendant le
 * blocage ne sont pas comptées.
 *
 * Cette fonction N'EST PLUS appelée par l'application : la règle s'applique
 * dans la base (`verify_attendance_code`), en une seule transaction, pour
 * résister aux requêtes simultanées. Elle reste ici, testée, comme
 * spécification exécutable de ce que la fonction SQL doit faire.
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
