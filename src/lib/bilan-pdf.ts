/** Bucket privé des PDF finaux de bilans (voir la migration). */
export const BILANS_BUCKET = "bilans";

/** Taille maximale d'un PDF de bilan : 10 Mo (même limite que le bucket). */
export const MAX_BILAN_PDF_BYTES = 10 * 1024 * 1024;

/** Seul type accepté. */
export const BILAN_PDF_MIME = "application/pdf";

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Chemin de stockage sûr : identifiant du bilan, identifiant unique, puis nom de
 * fichier sans accents ni caractères spéciaux. La base impose la même forme.
 */
export function buildBilanPdfPath(
  bilanId: string,
  fileName: string,
  uniqueId: string,
): string {
  const safeName =
    fileName
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(-80) || "bilan.pdf";
  return `${bilanId}/${uniqueId}-${safeName}`;
}

/**
 * Le chemin reçu a-t-il exactement la forme produite par `buildBilanPdfPath`
 * pour ce bilan ? Un simple test du début laisserait passer n'importe quel
 * suffixe venu du navigateur.
 */
export function isValidBilanPdfPath(bilanId: string, path: string): boolean {
  const prefix = `${bilanId}/`;
  if (!path.startsWith(prefix)) return false;
  return new RegExp(`^${UUID_PATTERN}-[A-Za-z0-9._-]{1,80}$`, "i").test(
    path.slice(prefix.length),
  );
}

/** Taille lisible : « 850 Ko » ou « 2,4 Mo ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
