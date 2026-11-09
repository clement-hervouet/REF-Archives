/**
 * Création de l'animation d'une saison sur un canvas (bloc 12, §3.14) :
 * - automne, hiver, printemps : `SnowfallCanvas` de `react-snowfall` (feuilles et pétales
 *   en images, avec rotation 3D) ; la classe ne touche jamais au style, donc à la CSP ;
 * - été : lucioles faites main (`fireflies.ts`).
 *
 * Les couleurs viennent des variables CSS `--seasonal-*` de `globals.css` (jamais en dur
 * dans les composants, §3.12), lues au démarrage pour le thème actif.
 */
import type { WeatherSeason } from "@/lib/seasonal-theme";
import { FireflyCanvas } from "./fireflies";
import type { CanvasAnimation } from "./fireflies";

export type SeasonalColors = {
  snow: string;
  firefly: string;
  leaves: string[];
  petals: string[];
};

function cssVariable(style: CSSStyleDeclaration, name: string): string {
  return style.getPropertyValue(name).trim();
}

/** Couleurs du thème actif (clair ou sombre), lues sur `<html>`. */
export function readSeasonalColors(): SeasonalColors {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => cssVariable(style, `--seasonal-${name}`);
  return {
    snow: read("snow"),
    firefly: read("firefly"),
    leaves: [read("leaf-1"), read("leaf-2"), read("leaf-3"), read("leaf-4")],
    petals: [read("petal-1"), read("petal-2"), read("petal-3")],
  };
}

// Formes dessinées sur 16 × 16 : une feuille avec sa nervure, un pétale effilé.
const LEAF_PATH = "M8 1C4 4 2 8 4 13c2 1 5 1 8-2 2-4 0-8-4-10z";
const LEAF_VEIN = "M8 3v11";
const PETAL_PATH = "M8 1c4 3 5 8 0 14C3 9 4 4 8 1z";

function svgImage(markup: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
  // `react-snowfall` met chaque image en cache au premier dessin : elle doit être prête.
  return image.decode().then(() => image);
}

function leafImage(color: string): Promise<HTMLImageElement> {
  return svgImage(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16"><path d="${LEAF_PATH}" fill="${color}"/><path d="${LEAF_VEIN}" stroke="rgb(0 0 0 / 0.25)" stroke-width="0.6"/></svg>`,
  );
}

function petalImage(color: string): Promise<HTMLImageElement> {
  return svgImage(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16"><path d="${PETAL_PATH}" fill="${color}"/></svg>`,
  );
}

/**
 * `react-snowfall` fait partir chaque élément au-dessus de l'écran : sans rien faire, la page
 * resterait vide plusieurs secondes à chaque chargement. On avance donc la simulation d'un
 * grand pas : avec des vitesses différentes, les éléments se répartissent sur toute la
 * hauteur. `render` est privée en TypeScript mais publique à l'exécution ; la version est
 * figée (2.4.0, sans `^`) et, si la méthode disparaissait, l'animation partirait simplement
 * du haut.
 */
function fastForward(animation: CanvasAnimation, canvas: HTMLCanvasElement): void {
  if ("render" in animation && typeof animation.render === "function") {
    Reflect.apply(animation.render, animation, [canvas.offsetHeight * 2]);
  }
}

/** Démarre l'animation de `season` avec `count` éléments ; elle tourne dès sa création. */
export async function createSeasonalAnimation(
  canvas: HTMLCanvasElement,
  season: WeatherSeason,
  count: number,
  colors: SeasonalColors,
): Promise<CanvasAnimation> {
  if (season === "summer") {
    return new FireflyCanvas(canvas, count, colors.firefly);
  }
  // Chargée seulement quand une animation s'affiche (import dynamique, §3.14).
  const { SnowfallCanvas } = await import("react-snowfall/lib/SnowfallCanvas");
  if (season === "winter") {
    const snow = new SnowfallCanvas(canvas, {
      snowflakeCount: count,
      color: colors.snow,
      radius: [1, 3.5],
      speed: [0.5, 1.5],
      wind: [-0.5, 1],
      opacity: [0.5, 1],
    });
    fastForward(snow, canvas);
    return snow;
  }
  const autumn = season === "autumn";
  const images = await Promise.all(
    autumn ? colors.leaves.map(leafImage) : colors.petals.map(petalImage),
  );
  const falling = new SnowfallCanvas(canvas, {
    snowflakeCount: count,
    images,
    // Taille d'affichage des images, en pixels.
    radius: autumn ? [16, 26] : [10, 16],
    speed: autumn ? [0.6, 1.4] : [0.4, 1],
    wind: autumn ? [-0.5, 1.5] : [0.5, 2],
    rotationSpeed: autumn ? [-1.5, 1.5] : [-2, 2],
    enable3DRotation: true,
  });
  fastForward(falling, canvas);
  return falling;
}
