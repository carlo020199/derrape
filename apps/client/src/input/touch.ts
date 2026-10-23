// Controles táctiles en vertical: un dedo en cualquier parte de la pantalla (ver gestures.ts).
// Acelerar es automático. El primer dedo gira; los demás solo sirven para los objetos.

import { FingerGesture, type ItemAction } from "./gestures";

export interface TouchState {
  /** Hay algún dedo en la pantalla (sirve de "acelerador" en la salida con turbo). */
  holding: boolean;
  steer: number;
  /** El dedo que gira está derrapando. */
  drift: boolean;
  /** Lado del derrape (-1/1) o 0. */
  driftSide: number;
  /** true desde el primer toque: se usan los controles táctiles. */
  active: boolean;
}

export const touch: TouchState = { holding: false, steer: 0, drift: false, driftSide: 0, active: false };

const itemQueue: ItemAction[] = [];

/** Saca el siguiente gesto de objeto pendiente. */
export function takeItemAction(): ItemAction | undefined {
  return itemQueue.shift();
}

/** Para el teclado: E / Enter = usar (adelante), Q = lanzar atrás. */
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "KeyE" || e.code === "Enter") itemQueue.push("forward");
  if (e.code === "KeyQ") itemQueue.push("back");
});

export function setupTouchControls(zone: HTMLElement) {
  const fingers = new Map<number, FingerGesture>();
  let steering: number | null = null;

  const activate = () => {
    if (touch.active) return;
    touch.active = true;
    document.body.classList.add("touch");
  };
  window.addEventListener("touchstart", activate, { passive: true });

  const sync = () => {
    touch.holding = fingers.size > 0;
    const g = steering === null ? undefined : fingers.get(steering);
    touch.steer = g?.steer ?? 0;
    touch.driftSide = g?.driftSide ?? 0;
    touch.drift = touch.driftSide !== 0;
  };

  zone.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {
      // Puntero ya inactivo: no pasa nada, se siguen recibiendo eventos en la zona.
    }
    fingers.set(e.pointerId, new FingerGesture(e.clientX, e.clientY, e.timeStamp));
    if (steering === null) steering = e.pointerId;
    sync();
  });
  zone.addEventListener("pointermove", (e) => {
    fingers.get(e.pointerId)?.move(e.clientX, e.clientY);
    if (e.pointerId === steering) sync();
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    const g = fingers.get(e.pointerId);
    if (!g) return;
    fingers.delete(e.pointerId);
    const action = cancelled ? null : g.release(e.timeStamp);
    if (action) itemQueue.push(action);
    if (e.pointerId === steering) steering = null;
    sync();
  };
  zone.addEventListener("pointerup", (e) => end(e, false));
  zone.addEventListener("pointercancel", (e) => end(e, true));

  // Evitar zoom, scroll, selección y menú contextual.
  document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

/** Suelta todo (al pausar o cambiar de app). */
export function releaseTouch() {
  touch.holding = false;
  touch.steer = 0;
  touch.drift = false;
  touch.driftSide = 0;
  itemQueue.length = 0;
}
