import { describe, expect, it } from "vitest";

import {
  buildAssetPath,
  detectImageType,
  isAssetKind,
  isAssetPath,
  MAX_ASSET_BYTES,
} from "@/lib/org-assets";

const ID = "0b6f5d52-1d4c-4a45-8f1a-7c2e9a4d5b33";

describe("detectImageType", () => {
  it("reconnaît un PNG d'après son en-tête", () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0,
    ]);
    expect(detectImageType(png)).toBe("png");
  });

  it("reconnaît un JPEG d'après son en-tête", () => {
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "jpg",
    );
  });

  it("refuse un PDF, un GIF, un texte et un fichier vide", () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(detectImageType(encode("%PDF-1.7"))).toBeNull();
    expect(detectImageType(encode("GIF89a"))).toBeNull();
    expect(detectImageType(encode("<svg></svg>"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });

  it("refuse un en-tête PNG incomplet", () => {
    expect(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e]))).toBeNull();
  });
});

describe("chemins de stockage", () => {
  it("construit un chemin accepté par le contrôle", () => {
    const path = buildAssetPath("logo", "png", ID);
    expect(path).toBe(`logo/${ID}.png`);
    expect(isAssetPath("logo", path)).toBe(true);
    expect(
      isAssetPath("signature", buildAssetPath("signature", "jpg", ID)),
    ).toBe(true);
  });

  it("refuse un chemin d'un autre type, une extension inconnue ou une remontée de dossier", () => {
    expect(isAssetPath("logo", `signature/${ID}.png`)).toBe(false);
    expect(isAssetPath("logo", `logo/${ID}.gif`)).toBe(false);
    expect(isAssetPath("logo", `logo/../${ID}.png`)).toBe(false);
    expect(isAssetPath("logo", `logo/${ID}.png/extra`)).toBe(false);
  });
});

describe("constantes", () => {
  it("reconnaît les deux types d'image et limite la taille à 500 Ko", () => {
    expect(isAssetKind("logo")).toBe(true);
    expect(isAssetKind("signature")).toBe(true);
    expect(isAssetKind("favicon")).toBe(false);
    expect(isAssetKind(undefined)).toBe(false);
    expect(MAX_ASSET_BYTES).toBe(512000);
  });
});
