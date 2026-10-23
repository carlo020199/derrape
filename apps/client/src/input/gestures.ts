// Lógica de los gestos táctiles, sin DOM (para poder testearla).
//
// Un dedo en cualquier parte de la pantalla:
// - arrastrar a los lados = girar; arrastrar lejos = derrapar (al soltar, mini-turbo)
// - toque = usar objeto; deslizar arriba = lanzarlo adelante; abajo = lanzarlo atrás

import { TOUCH, type ItemAction } from "@derrape/shared";

export type { ItemAction };

/** Gesto de un dedo desde que toca hasta que se levanta. */
export class FingerGesture {
  private readonly startX: number;
  private readonly startY: number;
  private readonly startTime: number;
  private originX: number;
  private maxMove = 0;
  private lastX: number;
  private lastY: number;
  /** -1/1 mientras el dedo está derrapando; 0 si no. */
  driftSide = 0;

  constructor(x: number, y: number, time: number, private readonly t = TOUCH) {
    this.startX = this.originX = this.lastX = x;
    this.startY = this.lastY = y;
    this.startTime = time;
  }

  move(x: number, y: number) {
    this.lastX = x;
    this.lastY = y;
    this.maxMove = Math.max(this.maxMove, Math.hypot(x - this.startX, y - this.startY));
    // Si el dedo se pasa del rango, el centro le sigue: volver un poco ya endereza.
    const over = x - this.originX;
    if (Math.abs(over) > this.t.steerRange) this.originX = x - Math.sign(over) * this.t.steerRange;
    if (this.driftSide === 0 && Math.abs(this.rawSteer()) >= this.t.driftTrigger) {
      this.driftSide = Math.sign(this.rawSteer());
    }
  }

  private rawSteer() {
    return Math.max(-1, Math.min(1, (this.lastX - this.originX) / this.t.steerRange));
  }

  /** Giro -1..1. */
  get steer(): number {
    const s = this.rawSteer();
    return Math.abs(s) < this.t.deadZone ? 0 : s;
  }

  /** Al levantar el dedo: ¿ha sido un gesto de objeto? */
  release(time: number): ItemAction | null {
    const ms = time - this.startTime;
    const dx = this.lastX - this.startX;
    const dy = this.lastY - this.startY;
    if (ms <= this.t.swipeMaxMs && Math.abs(dy) >= this.t.swipeMin && Math.abs(dy) > Math.abs(dx) * 1.2) {
      return dy < 0 ? "forward" : "back";
    }
    if (ms <= this.t.tapMaxMs && this.maxMove <= this.t.tapSlop) return "use";
    return null;
  }
}
