import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { FetchLogo } from "./ffbb-logos";
import {
  clearWhiteBackground,
  prepareLogo,
  visibleBounds,
  withPreparedLogo,
} from "./logo-background";

type Pixel = readonly [number, number, number, number];
const WHITE: Pixel = [255, 255, 255, 255];
const RED: Pixel = [200, 20, 20, 255];
const CLEAR: Pixel = [0, 0, 0, 0];

/** Image à partir d'un dessin : une lettre par pixel. */
function draw(rows: readonly string[], palette: Record<string, Pixel>) {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const data = new Uint8Array(width * height * 4);
  rows.forEach((row, y) => {
    Array.from(row).forEach((char, x) => {
      data.set(palette[char] ?? WHITE, (y * width + x) * 4);
    });
  });
  return { data, width, height };
}

const alphaAt = (data: Uint8Array, width: number, x: number, y: number) =>
  data[(y * width + x) * 4 + 3];

describe("clearWhiteBackground", () => {
  it("retire le blanc relié aux bords et garde le blanc entouré par le dessin", () => {
    const image = draw(["......", ".rrrr.", ".r..r.", ".rrrr.", "......"], { ".": WHITE, r: RED });
    const result = clearWhiteBackground(image);
    expect(result?.cleared).toBe(18);
    expect(alphaAt(result?.data ?? new Uint8Array(), 6, 0, 0)).toBe(0);
    // Intérieur du cadre rouge : blanc gardé, opaque.
    expect(alphaAt(result?.data ?? new Uint8Array(), 6, 2, 2)).toBe(255);
    expect(alphaAt(result?.data ?? new Uint8Array(), 6, 1, 1)).toBe(255);
    // L'image d'origine n'est pas modifiée.
    expect(alphaAt(image.data, 6, 0, 0)).toBe(255);
  });

  it("laisse tel quel un logo déjà détouré, même avec un contour blanc", () => {
    const image = draw(["....", ".ww.", ".rr.", "...."], { ".": CLEAR, w: WHITE, r: RED });
    const result = clearWhiteBackground(image);
    expect(result?.cleared).toBe(0);
    expect(alphaAt(result?.data ?? new Uint8Array(), 4, 1, 1)).toBe(255);
  });

  it("ne touche pas une image presque entièrement blanche", () => {
    const rows = Array.from({ length: 10 }, () => "..........");
    expect(clearWhiteBackground(draw(rows, { ".": WHITE }))).toBeNull();
  });

  it("rend partiellement transparent un pixel clair au bord du fond, sans liseré blanc", () => {
    const LIGHT_RED: Pixel = [255, 222, 222, 255];
    const image = draw(["....", ".lr.", "...."], { ".": WHITE, l: LIGHT_RED, r: RED });
    const result = clearWhiteBackground(image);
    const offset = (1 * 4 + 1) * 4;
    const alpha = result?.data[offset + 3] ?? 255;
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(255);
    // Couleur « dé-mélangée » du blanc : plus saturée que le pixel d'origine.
    expect(result?.data[offset + 1]).toBeLessThan(222);
  });
});

describe("visibleBounds", () => {
  it("cadre les pixels visibles avec une marge, bornée à l'image", () => {
    const image = draw(["......", "......", "...r..", "......"], { ".": CLEAR, r: RED });
    expect(visibleBounds(image, 1)).toEqual({ left: 2, top: 1, width: 3, height: 3 });
    expect(visibleBounds(image, 5)).toEqual({ left: 0, top: 0, width: 6, height: 4 });
  });

  it("rend null pour une image vide", () => {
    expect(visibleBounds(draw(["..", ".."], { ".": CLEAR }))).toBeNull();
  });
});

describe("prepareLogo", () => {
  it("détoure, rogne et encode en WebP un logo sur fond blanc", async () => {
    // 100×140 blanc, carré rouge de 20 px au milieu.
    const square = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 200, g: 20, b: 20 } },
    })
      .png()
      .toBuffer();
    const bytes = await sharp({
      create: { width: 100, height: 140, channels: 3, background: "#ffffff" },
    })
      .composite([{ input: square, left: 40, top: 60 }])
      .jpeg()
      .toBuffer();

    const result = await prepareLogo({ mime: "image/jpeg", bytes: new Uint8Array(bytes) });

    expect(result.mime).toBe("image/webp");
    const { data, info } = await sharp(result.bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Rogné au carré et à sa marge, coins transparents.
    expect(info.width).toBeLessThanOrEqual(26);
    expect(info.height).toBeLessThanOrEqual(26);
    expect(data[3]).toBe(0);
  });

  it("garde l'original s'il ne se décode pas", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logo = { mime: "image/png" as const, bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) };
    expect(await prepareLogo(logo)).toBe(logo);
  });
});

describe("withPreparedLogo", () => {
  it("transmet un échec du téléchargement", async () => {
    const fetchLogo = vi.fn<FetchLogo>().mockResolvedValue(null);
    expect(await withPreparedLogo(fetchLogo)("uuid")).toBeNull();
  });
});
