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

let hintTimer = 0;

/** Vuelve a enseñar la ayuda táctil al empezar una carrera. Se va al primer toque o a los 4 s. */
export function showTouchHint() {
  document.body.classList.remove("hint-gone");
  const hint = document.querySelector<HTMLElement>("#touch-help");
  if (!hint) return;
  hint.classList.remove("show");
  void hint.offsetWidth;
  hint.classList.add("show");
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => document.body.classList.add("hint-gone"), 4500);
}

export function setupTouchControls(zone: HTMLElement) {
  // En un móvil la ayuda de teclado no debe asomar ni antes del primer toque.
  if (window.matchMedia("(pointer: coarse)").matches) {
    touch.active = true;
    document.body.classList.add("touch");
  }
  const fingers = new Map<number, FingerGesture>();
  let steering: number | null = null;

  const activate = () => {
    if (touch.active) return;
    touch.active = true;
    document.body.classList.add("touch");
  };
  window.addEventListener("touchstart", activate, { passive: true });
  window.addEventListener("pointerdown", () => {
    if (document.body.classList.contains("in-menu")) return;
    document.body.classList.add("hint-gone");
  });

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
  document.addEventListener(
    "touchmove",
    (e) => {
      // En las pantallas de menú sí se puede desplazar.
      if (!(e.target instanceof Element && e.target.closest(".screen"))) e.preventDefault();
    },
    { passive: false },
  );
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
