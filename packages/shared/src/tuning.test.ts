import { describe, expect, it } from "vitest";
import { MAX_PLAYERS, MIN_PLAYERS, PHYSICS_DT, PHYSICS_HZ } from "./tuning";

describe("tuning", () => {
  it("el paso de física es coherente con la frecuencia", () => {
    expect(PHYSICS_DT * PHYSICS_HZ).toBeCloseTo(1);
  });

  it("los límites de jugadores son válidos", () => {
    expect(MIN_PLAYERS).toBeGreaterThanOrEqual(2);
    expect(MAX_PLAYERS).toBeGreaterThanOrEqual(MIN_PLAYERS);
  });
});
