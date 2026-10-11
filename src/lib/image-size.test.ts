import { describe, expect, it } from "vitest";

import { fitInBox, readImageSize } from "@/lib/image-size";

/** PNG minimal : signature, bloc IHDR avec largeur et hauteur. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

/** JPEG minimal : un bloc APP0 à sauter, puis un marqueur de trame SOF0. */
function jpeg(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x06,
    0x4a,
    0x46,
    0x49,
    0x46,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
  ]);
}

describe("readImageSize", () => {
  it("lit les dimensions d'un PNG", () => {
    expect(readImageSize(png(320, 120), "png")).toEqual({
      width: 320,
      height: 120,
    });
  });

  it("lit les dimensions d'un JPEG, en sautant les blocs qui précèdent", () => {
    expect(readImageSize(jpeg(200, 100), "jpg")).toEqual({
      width: 200,
      height: 100,
    });
  });

  it("renvoie null pour un contenu trop court ou sans dimensions", () => {
    expect(readImageSize(new Uint8Array(5), "png")).toBeNull();
    expect(readImageSize(png(0, 0), "png")).toBeNull();
    expect(
      readImageSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), "jpg"),
    ).toBeNull();
  });
});

describe("fitInBox", () => {
  it("réduit en gardant les proportions", () => {
    expect(fitInBox({ width: 400, height: 200 }, 200, 100)).toEqual({
      width: 200,
      height: 100,
    });
    // La hauteur est le facteur limitant.
    expect(fitInBox({ width: 100, height: 400 }, 200, 100)).toEqual({
      width: 25,
      height: 100,
    });
  });

  it("n'agrandit jamais une petite image", () => {
    expect(fitInBox({ width: 50, height: 20 }, 200, 100)).toEqual({
      width: 50,
      height: 20,
    });
  });
});
