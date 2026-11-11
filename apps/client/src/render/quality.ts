// Calidad automática: si los fps caen de forma sostenida, se baja la resolución interna;
// si luego van sobrados un buen rato, se vuelve a subir (un tirón al cargar no debe dejar la
// carrera entera con peor imagen).

/** Límite de pixel ratio (las pantallas 3x no compensan lo que cuestan). */
export const MAX_PIXEL_RATIO = 2;
/**
 * El contorno de los pilotos se quita en el último escalón (0,75).
 * No hay bloom: el fuego es aditivo y ya se lee sin él.
 */
export function showDriverOutline(pixelRatio: number) {
  return pixelRatio >= 1;
}
/** Pasos de resolución, de mejor a peor. */
const STEPS = [2, 1.5, 1.25, 1, 0.75];
/** Por debajo de estos fps durante `SLOW_SECONDS` se baja un paso. */
const MIN_FPS = 50;
const SLOW_SECONDS = 3;
/** Por encima de estos fps durante `FAST_SECONDS` se sube un paso. */
const RECOVER_FPS = 58;
const FAST_SECONDS = 10;
/** Si al subir vuelve a ir lento en este tiempo, ese paso queda vetado (para no ir y venir). */
const RETRY_WINDOW = 15;

export class AutoQuality {
  private step: number;
  /** El mejor paso al que se puede volver. */
  private ceiling: number;
  private slowTime = 0;
  private fastTime = 0;
  private sinceUpgrade = Infinity;

  constructor(
    private readonly apply: (pixelRatio: number) => void,
    devicePixelRatio = window.devicePixelRatio,
  ) {
    const start = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    this.step = STEPS.findIndex((s) => s <= start);
    if (this.step < 0) this.step = STEPS.length - 1;
    this.ceiling = this.step;
    apply(this.pixelRatio);
  }

  get pixelRatio() {
    return STEPS[this.step]!;
  }

  /** Llamar con los fps medidos cada `seconds` segundos. */
  report(fps: number, seconds: number) {
    this.sinceUpgrade += seconds;
    if (fps < MIN_FPS) {
      this.fastTime = 0;
      this.slowTime += seconds;
      if (this.slowTime >= SLOW_SECONDS && this.step < STEPS.length - 1) {
        // Acaba de subir y no aguanta: no se vuelve a intentar ese paso.
        if (this.sinceUpgrade < RETRY_WINDOW) this.ceiling = this.step + 1;
        this.step++;
        this.slowTime = 0;
        this.apply(this.pixelRatio);
      }
      return;
    }
    this.slowTime = 0;
    this.fastTime = fps >= RECOVER_FPS ? this.fastTime + seconds : 0;
    if (this.fastTime >= FAST_SECONDS && this.step > this.ceiling) {
      this.step--;
      this.fastTime = 0;
      this.sinceUpgrade = 0;
      this.apply(this.pixelRatio);
    }
  }

  /** Tras una pausa, los fps del primer momento no cuentan. */
  reset() {
    this.slowTime = 0;
    this.fastTime = 0;
  }
}
