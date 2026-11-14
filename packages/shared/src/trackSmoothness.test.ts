import { describe, expect, it } from "vitest";
import { TRACKS } from "./tracks";
import { buildTrackFromDef } from "./tracks/types";
import { measureSmoothness } from "./trackSmoothness";

describe("medidas de suavidad", () => {
  it("las 12 pistas se pueden medir", async () => {
    expect(TRACKS).toHaveLength(12);
    for (const entry of TRACKS) {
      const m = measureSmoothness(buildTrackFromDef(await entry.load()));
      expect(Number.isFinite(m.maxGrade)).toBe(true);
      expect(Number.isFinite(m.maxNormalJump)).toBe(true);
    }
  });
});
