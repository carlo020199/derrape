import { describe, expect, it } from "vitest";
import { projectMinimap } from "./minimap";

const bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 80 };
const size = { w: 120, h: 120, pad: 10 };

describe("minimapa", () => {
  it("voltea X: más x del mundo cae más a la izquierda", () => {
    const [left] = projectMinimap(0, 40, bounds, size.w, size.h, size.pad);
    const [right] = projectMinimap(100, 40, bounds, size.w, size.h, size.pad);
    expect(right).toBeLessThan(left);
  });

  it("deja +z arriba", () => {
    const [, bottom] = projectMinimap(50, 0, bounds, size.w, size.h, size.pad);
    const [, top] = projectMinimap(50, 80, bounds, size.w, size.h, size.pad);
    expect(top).toBeLessThan(bottom);
  });

  it("un óvalo cabe dentro del círculo y no se recorta en el borde", () => {
    const oval = { minX: -170, maxX: 170, minZ: -220, maxZ: 220 };
    const w = 120;
    const h = 120;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const [sx, sy] = projectMinimap(170 * Math.cos(a), 220 * Math.sin(a), oval, w, h, 14);
      const dx = sx - w / 2;
      const dy = sy - h / 2;
      expect(Math.hypot(dx, dy)).toBeLessThan(w / 2 - 6);
    }
  });
});
