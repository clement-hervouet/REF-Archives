/**
 * Mise en forme d'un logo pour la pastille, une fois au téléchargement :
 * 1. le fond blanc devient transparent. Seul le blanc relié au bord de l'image est retiré
 *    (remplissage depuis les bords) : le blanc à l'intérieur du logo (lettres, motifs
 *    entourés d'un contour) est gardé. Les pixels de transition gardent une transparence
 *    partielle, sans liseré blanc ;
 * 2. les marges vides sont rognées : les logos de la FFBB sont en portrait 250×350, le
 *    dessin au milieu, et paraîtraient minuscules dans une pastille ;
 * 3. le résultat est ramené à 128 px au plus et encodé en WebP avec transparence.
 *
 * Fond presque entièrement blanc (logo blanc sur blanc ?), image vide ou erreur de
 * décodage : le logo est gardé tel qu'il a été téléchargé.
 */
import sharp from "sharp";
import type { FetchLogo, LogoImage } from "./ffbb-logos";
import { MAX_LOGO_BYTES } from "./ffbb-logos";

/** Pixels RGBA, 4 octets par pixel, ligne par ligne. */
export type RgbaImage = { data: Uint8Array; width: number; height: number };

export type Bounds = { left: number; top: number; width: number; height: number };

/** Blanc : chaque canal au moins à cette valeur (tolère les artefacts JPEG). */
const WHITE_MIN = 235;
/** Clair, à la frontière du fond : rendu partiellement transparent. */
const EDGE_MIN = 190;
/** Déjà transparent : fait partie du fond. */
const TRANSPARENT_MAX = 24;
/** Au-delà de cette part de l'image, le « fond » est sans doute le logo : on n'y touche pas. */
const MAX_CLEARED_RATIO = 0.99;
/** Marge gardée autour du dessin, en pixels de l'image d'origine. */
const TRIM_MARGIN = 2;
const OUTPUT_SIZE = 128;

function isBackground(data: Uint8Array, offset: number): boolean {
  const alpha = data[offset + 3] ?? 0;
  if (alpha <= TRANSPARENT_MAX) {
    return true;
  }
  const r = data[offset] ?? 0;
  const g = data[offset + 1] ?? 0;
  const b = data[offset + 2] ?? 0;
  return Math.min(r, g, b) >= WHITE_MIN;
}

/** Vrai si la plupart des pixels du bord sont déjà transparents (logo déjà détouré). */
function hasTransparentBorder(image: RgbaImage): boolean {
  const { data, width, height } = image;
  let transparent = 0;
  let count = 0;
  const check = (index: number) => {
    count++;
    if ((data[index * 4 + 3] ?? 0) <= TRANSPARENT_MAX) {
      transparent++;
    }
  };
  for (let x = 0; x < width; x++) {
    check(x);
    check((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    check(y * width);
    check(y * width + width - 1);
  }
  return transparent * 2 > count;
}

/**
 * Rend transparent le fond blanc relié aux bords. Renvoie une copie, et le nombre de pixels
 * blancs opaques retirés (0 : aucun fond blanc, ou logo déjà détouré, laissé tel quel pour
 * ne pas effacer un contour blanc dessiné sur la transparence). `null` si le fond couvre
 * presque toute l'image (rien n'est changé).
 */
export function clearWhiteBackground(
  image: RgbaImage,
): { data: Uint8Array; cleared: number } | null {
  const { width, height } = image;
  const total = width * height;
  const data = Uint8Array.from(image.data);
  if (hasTransparentBorder(image)) {
    return { data, cleared: 0 };
  }
  const background = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const visit = (index: number) => {
    if (background[index] === 0 && isBackground(data, index * 4)) {
      background[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++] ?? 0;
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < total - width) visit(index + width);
  }

  let cleared = 0;
  for (let index = 0; index < total; index++) {
    if (background[index] === 1) {
      const offset = index * 4;
      if ((data[offset + 3] ?? 0) > TRANSPARENT_MAX) {
        cleared++;
      }
      data[offset + 3] = 0;
    }
  }
  if (cleared > total * MAX_CLEARED_RATIO) {
    return null;
  }
  if (cleared > 0) {
    softenEdges(data, background, width, height);
  }
  return { data, cleared };
}

/**
 * Pixels clairs au bord du fond retiré (anticrénelage sur fond blanc) : transparence
 * partielle, et couleur « dé-mélangée » du blanc pour ne pas laisser de liseré.
 */
function softenEdges(data: Uint8Array, background: Uint8Array, width: number, height: number) {
  const total = width * height;
  for (let index = 0; index < total; index++) {
    if (background[index] === 1) {
      continue;
    }
    const x = index % width;
    const touchesBackground =
      (x > 0 && background[index - 1] === 1) ||
      (x < width - 1 && background[index + 1] === 1) ||
      (index >= width && background[index - width] === 1) ||
      (index < total - width && background[index + width] === 1);
    if (!touchesBackground) {
      continue;
    }
    const offset = index * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const lightest = Math.min(r, g, b);
    if (lightest < EDGE_MIN) {
      continue;
    }
    // Part du dessin dans ce pixel : 1 à EDGE_MIN, 0 au blanc pur.
    const coverage = Math.max(0.05, (255 - lightest) / (255 - EDGE_MIN));
    const unblend = (channel: number) =>
      Math.round(Math.min(255, Math.max(0, (channel - 255 * (1 - coverage)) / coverage)));
    data[offset] = unblend(r);
    data[offset + 1] = unblend(g);
    data[offset + 2] = unblend(b);
    data[offset + 3] = Math.round((data[offset + 3] ?? 0) * coverage);
  }
}

/** Cadre des pixels visibles, avec une petite marge ; `null` si l'image est vide. */
export function visibleBounds(image: RgbaImage, margin = TRIM_MARGIN): Bounds | null {
  const { data, width, height } = image;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > TRANSPARENT_MAX) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < 0) {
    return null;
  }
  left = Math.max(0, left - margin);
  top = Math.max(0, top - margin);
  right = Math.min(width - 1, right + margin);
  bottom = Math.min(height - 1, bottom + margin);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Logo détouré, rogné et ramené à 128 px ; l'original si le traitement n'aboutit pas. */
export async function prepareLogo(logo: LogoImage): Promise<LogoImage> {
  try {
    const { data, info } = await sharp(logo.bytes, { limitInputPixels: 1_000_000 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image = { data, width: info.width, height: info.height };
    const cleared = clearWhiteBackground(image);
    if (cleared === null) {
      return logo;
    }
    const bounds = visibleBounds({ ...image, data: cleared.data });
    if (bounds === null) {
      return logo;
    }
    const bytes = await sharp(cleared.data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract(bounds)
      .resize({ width: OUTPUT_SIZE, height: OUTPUT_SIZE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) {
      return logo;
    }
    return { mime: "image/webp", bytes: new Uint8Array(bytes) };
  } catch (error) {
    console.error(`[ffbb] logo non retraité (${error instanceof Error ? error.name : "inconnue"})`);
    return logo;
  }
}

/** Télécharge le logo puis le met en forme pour la pastille. */
export function withPreparedLogo(fetchLogo: FetchLogo): FetchLogo {
  return async (uuid) => {
    const logo = await fetchLogo(uuid);
    return logo === null ? null : prepareLogo(logo);
  };
}
