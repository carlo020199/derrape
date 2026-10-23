// Controles táctiles: mitad izquierda = joystick invisible; derecha = botones.

/** Píxeles de arrastre para girar al máximo. */
const JOYSTICK_RANGE = 70;
/** Zona muerta del joystick (fracción del rango). */
const DEAD_ZONE = 0.08;

export interface TouchState {
  steer: number;
  throttle: boolean;
  brake: boolean;
  drift: boolean;
  item: boolean;
  /** true desde el primer toque: se muestran los controles y se usan. */
  active: boolean;
}

export const touch: TouchState = {
  steer: 0,
  throttle: false,
  brake: false,
  drift: false,
  item: false,
  active: false,
};

export function setupTouchControls(root: HTMLElement) {
  const ring = root.querySelector<HTMLDivElement>("#stick")!;
  const knob = root.querySelector<HTMLDivElement>("#stick-knob")!;
  const zone = root.querySelector<HTMLDivElement>("#steer-zone")!;

  let stickId: number | null = null;
  let originX = 0;
  let originY = 0;

  const activate = () => {
    if (touch.active) return;
    touch.active = true;
    document.body.classList.add("touch");
  };
  window.addEventListener("touchstart", activate, { passive: true });

  zone.addEventListener("pointerdown", (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    originX = e.clientX;
    originY = e.clientY;
    ring.style.transform = `translate(${originX}px, ${originY}px)`;
    knob.style.transform = "translate(0px, 0px)";
    ring.hidden = false;
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== stickId) return;
    const dx = Math.max(-JOYSTICK_RANGE, Math.min(JOYSTICK_RANGE, e.clientX - originX));
    const raw = dx / JOYSTICK_RANGE;
    touch.steer = Math.abs(raw) < DEAD_ZONE ? 0 : raw;
    knob.style.transform = `translate(${dx}px, 0px)`;
    // Si el dedo se aleja mucho, el centro le sigue (joystick "flotante").
    const over = e.clientX - originX - dx;
    if (over !== 0) {
      originX += over;
      ring.style.transform = `translate(${originX}px, ${originY}px)`;
    }
  });
  const endStick = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    touch.steer = 0;
    ring.hidden = true;
  };
  zone.addEventListener("pointerup", endStick);
  zone.addEventListener("pointercancel", endStick);

  // Botones: cada uno lleva la cuenta de los dedos que lo pulsan.
  const bind = (id: string, key: "throttle" | "brake" | "drift" | "item") => {
    const el = root.querySelector<HTMLElement>(id)!;
    const fingers = new Set<number>();
    const update = () => {
      touch[key] = fingers.size > 0;
      el.classList.toggle("pressed", touch[key]);
    };
    el.addEventListener("pointerdown", (e) => {
      fingers.add(e.pointerId);
      el.setPointerCapture(e.pointerId);
      update();
    });
    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      update();
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  bind("#btn-drift", "drift");
  bind("#btn-brake", "brake");
  bind("#btn-item", "item");
  bind("#btn-gas", "throttle");

  // Evitar zoom, scroll, selección y menú contextual.
  document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

/** Suelta todo (al pausar o cambiar de app). */
export function releaseTouch() {
  touch.steer = 0;
  touch.throttle = touch.brake = touch.drift = touch.item = false;
}
