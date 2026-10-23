import { describe, expect, it } from "vitest";
import { AutoQuality } from "./quality";

/** Informa `seconds` segundos seguidos a `fps`, en tandas de medio segundo como el juego. */
function run(q: AutoQuality, fps: number, seconds: number) {
  for (let t = 0; t < seconds; t += 0.5) q.report(fps, 0.5);
}

describe("calidad automática", () => {
  it("empieza en el pixel ratio de la pantalla, con tope 2", () => {
    expect(new AutoQuality(() => {}, 3).pixelRatio).toBe(2);
    expect(new AutoQuality(() => {}, 1).pixelRatio).toBe(1);
  });

  it("baja si los fps caen de forma sostenida, no por un tirón", () => {
    const q = new AutoQuality(() => {}, 2);
    run(q, 30, 1);
    expect(q.pixelRatio).toBe(2);
    run(q, 30, 3);
    expect(q.pixelRatio).toBe(1.5);
  });

  it("vuelve a subir si luego va sobrado un buen rato, pero no por encima del inicio", () => {
    const q = new AutoQuality(() => {}, 2);
    run(q, 20, 6.5); // dos bajadas
    expect(q.pixelRatio).toBe(1.25);
    run(q, 60, 10);
    expect(q.pixelRatio).toBe(1.5);
    run(q, 60, 30);
    expect(q.pixelRatio).toBe(2);
  });

  it("si al subir vuelve a ir lento, se queda en el paso que aguanta", () => {
    const q = new AutoQuality(() => {}, 2);
    run(q, 30, 3); // 2 → 1,5
    run(q, 60, 10); // intenta 2
    run(q, 30, 3); // no aguanta → 1,5 y 2 queda vetado
    run(q, 60, 60);
    expect(q.pixelRatio).toBe(1.5);
  });
});
