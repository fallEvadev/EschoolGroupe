export type ImageSize = { width: number; height: number };

function u16(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function u32(bytes: Uint8Array, at: number): number {
  return (
    (((bytes[at] ?? 0) << 24) |
      ((bytes[at + 1] ?? 0) << 16) |
      ((bytes[at + 2] ?? 0) << 8) |
      (bytes[at + 3] ?? 0)) >>>
    0
  );
}

/** PNG : largeur et hauteur sont dans le bloc IHDR, juste après la signature. */
function pngSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 24) return null;
  const width = u32(bytes, 16);
  const height = u32(bytes, 20);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** Marqueurs « début de trame » d'un JPEG : ils portent les dimensions. */
function isStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
  );
}

/** JPEG : on saute les blocs jusqu'au premier marqueur de trame. */
function jpegSize(bytes: Uint8Array): ImageSize | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1] ?? 0;
    // Octets de remplissage (0xFF répétés) et marqueurs sans contenu.
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (
      marker === 0xd8 ||
      (marker >= 0xd0 && marker <= 0xd7) ||
      marker === 0x01
    ) {
      i += 2;
      continue;
    }
    if (isStartOfFrame(marker)) {
      const height = u16(bytes, i + 5);
      const width = u16(bytes, i + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + u16(bytes, i + 2);
  }
  return null;
}

/** Dimensions d'une image PNG ou JPEG d'après son contenu, `null` si illisible. */
export function readImageSize(
  bytes: Uint8Array,
  type: "png" | "jpg",
): ImageSize | null {
  return type === "png" ? pngSize(bytes) : jpegSize(bytes);
}

/**
 * Taille à l'affichage : l'image entre dans la boîte (largeur et hauteur
 * maximales), sans être déformée ni agrandie.
 */
export function fitInBox(
  size: ImageSize,
  maxWidth: number,
  maxHeight: number,
): ImageSize {
  const ratio = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}
