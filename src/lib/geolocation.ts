import type { DevicePosition } from "@/lib/attendance";

/** Code d'erreur du navigateur quand l'utilisateur refuse la localisation. */
const PERMISSION_DENIED = 1;

/**
 * « Refusée » si la personne a refusé l'accès, « indisponible » pour tout le
 * reste (signal introuvable, délai dépassé, appareil sans GPS).
 */
export function mapGeolocationError(code: number): "refusee" | "indisponible" {
  return code === PERMISSION_DENIED ? "refusee" : "indisponible";
}

/**
 * Relève la position du téléphone. Ne rejette jamais : en cas d'échec, renvoie
 * la raison, pour que le pointage soit quand même envoyé (et marqué « à
 * vérifier ») au lieu de bloquer le formateur.
 */
export function getDevicePosition(timeoutMs = 15_000): Promise<DevicePosition> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({ status: "indisponible" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: "ok",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      (error) => resolve({ status: mapGeolocationError(error.code) }),
      // Position fraîche et précise, pas une valeur gardée en mémoire.
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
