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
});
