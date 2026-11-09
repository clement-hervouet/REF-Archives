"use client";

/**
 * Calque animé du thème saisonnier (bloc 12, §3.14) : un seul canvas fixe, DERRIÈRE le
 * contenu (`-z-10`), purement décoratif (`aria-hidden`, aucun clic intercepté).
 *
 * - Rien ne démarre si l'appareil demande de réduire les animations, et l'animation
 *   s'arrête si ce réglage change en cours de route.
 * - Pause quand l'onglet est caché (batterie, processeur).
 * - Le canvas est stylé par classes seulement : aucun attribut `style` (CSP stricte).
 */
import { useEffect, useRef } from "react";
import { SEASONAL_PARTICLE_COUNTS } from "@/lib/seasonal-theme";
import type { SeasonalDensity, WeatherSeason } from "@/lib/seasonal-theme";
import type { CanvasAnimation } from "./fireflies";
import { createSeasonalAnimation, readSeasonalColors } from "./seasonal-animation";

type Props = {
  season: WeatherSeason;
  density: SeasonalDensity;
};

/** Ajuste la surface de dessin à la taille affichée (attributs, pas de style). */
function fitCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

export function SeasonalLayer({ season, density }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    let animation: CanvasAnimation | null = null;
    // Chaque (re)démarrage a son numéro : un démarrage dépassé s'arrête de lui-même.
    let generation = 0;

    const stop = () => {
      generation += 1;
      animation?.pause();
      animation = null;
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const start = async () => {
      stop();
      if (reducedMotion.matches) return;
      const current = generation;
      fitCanvas(canvas);
      const count = SEASONAL_PARTICLE_COUNTS[season][density];
      const created = await createSeasonalAnimation(canvas, season, count, readSeasonalColors());
      if (current !== generation) {
        created.pause();
        return;
      }
      animation = created;
      if (document.hidden) animation.pause();
    };

    const restart = () => {
      start().catch(() => {
        // Décoratif : en cas d'échec (image, import), on n'affiche simplement rien.
        stop();
      });
    };
    const onResize = () => {
      fitCanvas(canvas);
    };
    const onVisibilityChange = () => {
      if (document.hidden) animation?.pause();
      else animation?.play();
    };

    restart();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", restart);
    // Thème « comme l'appareil » : les couleurs changent avec le système.
    darkScheme.addEventListener("change", restart);
    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", restart);
      darkScheme.removeEventListener("change", restart);
    };
  }, [season, density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-dvh w-full"
    />
  );
}
