import type { KartInput } from "@derrape/shared";

// Teclado para desarrollar en PC: flechas/WASD, Espacio = derrape.
const down = new Set<string>();

window.addEventListener("keydown", (e) => {
  down.add(e.code);
  if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => down.delete(e.code));
window.addEventListener("blur", () => down.clear());

export function readKeyboard(): KartInput {
  const left = down.has("ArrowLeft") || down.has("KeyA");
  const right = down.has("ArrowRight") || down.has("KeyD");
  return {
    steer: (right ? 1 : 0) - (left ? 1 : 0),
    throttle: down.has("ArrowUp") || down.has("KeyW"),
    brake: down.has("ArrowDown") || down.has("KeyS"),
    drift: down.has("Space") || down.has("ShiftLeft") || down.has("ShiftRight"),
  };
}
