/**
 * Lucioles de l'été (bloc 12, §3.14), faites main sur un canvas : des points dorés qui
 * montent lentement en ondulant et clignotent doucement. Même interface que
 * `SnowfallCanvas` (`play` / `pause`) pour que le calque les traite de la même façon.
 *
 * Aucun style touché (CSP) : tout est dessiné dans le canvas fourni.
 */

/** Ce que le calque attend d'une animation, lucioles comme `SnowfallCanvas`. */
export type CanvasAnimation = {
  play(): void;
  pause(): void;
};

type Firefly = {
  x: number;
  y: number;
  /** Vitesse de montée, en pixels par seconde. */
  rise: number;
  /** Amplitude et rythme de l'ondulation horizontale. */
  sway: number;
  swaySpeed: number;
  /** Phase et rythme du clignotement. */
  phase: number;
  blinkSpeed: number;
  radius: number;
};

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createFirefly(width: number, height: number, anywhere: boolean): Firefly {
  return {
    x: between(0, width),
    // Au démarrage, réparties sur toute la hauteur ; ensuite, elles repartent du bas.
    y: anywhere ? between(0, height) : height + between(5, 40),
    rise: between(8, 22),
    sway: between(10, 30),
    swaySpeed: between(0.2, 0.6),
    phase: between(0, Math.PI * 2),
    blinkSpeed: between(0.8, 1.8),
    radius: between(1.5, 2.6),
  };
}

export class FireflyCanvas implements CanvasAnimation {
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D | null;
  readonly #color: string;
  readonly #fireflies: Firefly[];
  #frame: number | undefined;
  #last = 0;
  #elapsed = 0;

  constructor(canvas: HTMLCanvasElement, count: number, color: string) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
    this.#color = color;
    this.#fireflies = Array.from({ length: count }, () =>
      createFirefly(canvas.offsetWidth, canvas.offsetHeight, true),
    );
    this.play();
  }

  play(): void {
    if (this.#frame !== undefined) return;
    this.#last = performance.now();
    this.#frame = requestAnimationFrame((now) => {
      this.#loop(now);
    });
  }

  pause(): void {
    if (this.#frame === undefined) return;
    cancelAnimationFrame(this.#frame);
    this.#frame = undefined;
  }

  #loop(now: number): void {
    // Au plus 0,1 s par image : au retour d'un onglet caché, pas de grand saut.
    const seconds = Math.min((now - this.#last) / 1000, 0.1);
    this.#last = now;
    this.#elapsed += seconds;
    this.#update(seconds);
    this.#draw();
    this.#frame = requestAnimationFrame((next) => {
      this.#loop(next);
    });
  }

  #update(seconds: number): void {
    const width = this.#canvas.offsetWidth;
    const height = this.#canvas.offsetHeight;
    this.#fireflies.forEach((firefly, index) => {
      firefly.y -= firefly.rise * seconds;
      if (firefly.y < -10) {
        this.#fireflies[index] = createFirefly(width, height, false);
      }
    });
  }

  #draw(): void {
    const ctx = this.#ctx;
    if (ctx === null) return;
    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.fillStyle = this.#color;
    for (const firefly of this.#fireflies) {
      const x =
        firefly.x + Math.sin(this.#elapsed * firefly.swaySpeed + firefly.phase) * firefly.sway;
      // Clignotement entre 15 % et 100 % d'opacité.
      const glow = 0.575 + 0.425 * Math.sin(this.#elapsed * firefly.blinkSpeed + firefly.phase);
      // Halo plat et pâle (pas de flou, §3.12), puis le point lui-même.
      ctx.globalAlpha = glow * 0.18;
      ctx.beginPath();
      ctx.arc(x, firefly.y, firefly.radius * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = glow;
      ctx.beginPath();
      ctx.arc(x, firefly.y, firefly.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
