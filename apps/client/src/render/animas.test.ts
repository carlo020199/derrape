import { describe, expect, it } from "vitest";
import { campanarioGeometry, flightCorridorMinY, jawLocalGeometry, triangleCount } from "./animas";

describe("Laguna de las Ánimas", () => {
  it("el campanario es una sola malla y no pasa de 1500 triángulos", () => {
    const geo = campanarioGeometry();
    expect(triangleCount(geo)).toBeLessThanOrEqual(1500);
    expect(triangleCount(geo)).toBeGreaterThan(100);
  });

  it("el cráneo del salto L deja 6 m libres sobre el ápice de 4,42 m", () => {
    const geo = jawLocalGeometry();
    expect(flightCorridorMinY(geo)).toBeGreaterThanOrEqual(4.42 + 6 - 0.05);
  });
});
