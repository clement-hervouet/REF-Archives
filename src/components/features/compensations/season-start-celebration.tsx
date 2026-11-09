"use client";

/**
 * Célébration de la première indemnité d'une saison FFBB (bloc 12d, §3.14) : un message
 * « bon début de saison 2026-2027 » et une salve de confettis (`canvas-confetti`).
 *
 * - Indépendante du thème saisonnier : affichée même s'il est désactivé.
 * - Avec `prefers-reduced-motion`, le message seul (aucun confetti).
 * - CSP : notre propre canvas, stylé par classes ; `useWorker: false`, car la bibliothèque
 *   créerait sinon un Worker en `blob:` que la CSP n'autorise pas. Bibliothèque chargée en
 *   import dynamique, seulement au moment de la salve.
 * - Monté à nouveau à chaque saisie réussie (clé du formulaire) : une salve par saisie.
 */
import { useEffect, useRef } from "react";
import { fr } from "@/i18n/fr";
import { seasonLabel } from "@/lib/seasons";

type Props = {
  /** Année de début de la saison FFBB (`2026` = 2026-2027). */
  season: number;
};

/** Couleurs de la palette, lues dans les variables `--confetti-*` du thème actif. */
function confettiColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  return [1, 2, 3, 4]
    .map((index) => style.getPropertyValue(`--confetti-${String(index)}`).trim())
    .filter((color) => color !== "");
}

async function fireConfetti(canvas: HTMLCanvasElement): Promise<() => void> {
  const { default: confetti } = await import("canvas-confetti");
  const shoot = confetti.create(canvas, {
    resize: true,
    useWorker: false,
    disableForReducedMotion: true,
  });
  const colors = confettiColors();
  // Deux tirs croisés depuis les coins bas : la salve traverse l'écran sans le masquer.
  void shoot({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.9 }, colors });
  void shoot({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.9 }, colors });
  return () => {
    shoot.reset();
  };
}

export function SeasonStartCelebration({ season }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let stop: (() => void) | null = null;
    let cancelled = false;
    fireConfetti(canvas)
      .then((reset) => {
        if (cancelled) reset();
        else stop = reset;
      })
      .catch(() => {
        // Décoratif : si la bibliothèque ne se charge pas, le message suffit.
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <>
      <p role="status" className="border-l-4 border-warning pl-3 font-semibold">
        {fr.compensations.new.seasonStart.replace("{season}", seasonLabel(season))}
      </p>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[60] h-dvh w-full"
      />
    </>
  );
}
