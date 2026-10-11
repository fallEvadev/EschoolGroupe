/** Bucket privé du logo et de la signature (voir la migration). */
export const ORG_ASSETS_BUCKET = "organization-assets";

export const ASSET_KINDS = ["logo", "signature"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_LABELS: Record<AssetKind, string> = {
  logo: "Logo E-School",
  signature: "Signature",
};

/** Taille maximale d'une image : 500 Ko (le serveur Next.js refuse au-delà d'1 Mo). */
export const MAX_ASSET_BYTES = 500 * 1024;

export type ImageType = "png" | "jpg";

export const IMAGE_MIME: Record<ImageType, string> = {
  png: "image/png",
  jpg: "image/jpeg",
};

export function isAssetKind(value: unknown): value is AssetKind {
  return (
    typeof value === "string" &&
    (ASSET_KINDS as readonly string[]).includes(value)
  );
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}

/**
 * Type réel d'une image d'après ses premiers octets. Le type annoncé par le
 * navigateur ou l'extension du fichier ne prouvent rien : seul le contenu compte.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "jpg";
  return null;
}

/** Chemin de stockage : `logo/<uuid>.png` ou `signature/<uuid>.jpg`. */
export function buildAssetPath(
  kind: AssetKind,
  type: ImageType,
  uniqueId: string,
): string {
  return `${kind}/${uniqueId}.${type}`;
}

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Le chemin a-t-il exactement la forme produite par `buildAssetPath` pour ce type d'image ? */
export function isAssetPath(kind: AssetKind, path: string): boolean {
  return new RegExp(`^${kind}/${UUID_PATTERN}\\.(png|jpg)$`).test(path);
}
