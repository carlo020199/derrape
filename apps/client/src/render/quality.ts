// Calidad automática: si los fps caen de forma sostenida, se baja la resolución interna.

/** Límite de pixel ratio (las pantallas 3x no compensan lo que cuestan). */
export const MAX_PIXEL_RATIO = 2;
/** Pasos de resolución, de mejor a peor. */
const STEPS = [2, 1.5, 1.25, 1, 0.75];
/** Por debajo de estos fps durante `SLOW_SECONDS` se baja un paso. */
const MIN_FPS = 50;
const SLOW_SECONDS = 3;

export class AutoQuality {
  private step: number;
  private slowTime = 0;

  constructor(private readonly apply: (pixelRatio: number) => void) {
    const start = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
    this.step = STEPS.findIndex((s) => s <= start);
    if (this.step < 0) this.step = STEPS.length - 1;
    apply(this.pixelRatio);
  }

  get pixelRatio() {
    return STEPS[this.step]!;
  }

  /** Llamar con los fps medidos cada `seconds` segundos. */
  report(fps: number, seconds: number) {
    if (fps >= MIN_FPS) {
      this.slowTime = 0;
      return;
    }
    this.slowTime += seconds;
    if (this.slowTime >= SLOW_SECONDS && this.step < STEPS.length - 1) {
      this.step++;
      this.slowTime = 0;
      this.apply(this.pixelRatio);
    }
  }

  /** Tras una pausa, los fps del primer momento no cuentan. */
  reset() {
    this.slowTime = 0;
  }
}
