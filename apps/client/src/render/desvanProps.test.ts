import { describe, expect, it } from "vitest";
import { buildTrackFromDef, closestPoint, findTrack } from "@derrape/shared";
import { sceneryPlacements } from "./desvanProps";

async function desvan() {
  const def = await findTrack("desvan-de-las-maravillas")!.load();
  return { def, track: buildTrackFromDef(def) };
}

describe("decorado de muebles gigantes del Desván", () => {
  it("tiene muchas piezas de al menos 6 clases, deterministas", async () => {
    const { def, track } = await desvan();
    const a = sceneryPlacements(track, def);
    expect(a.length).toBeGreaterThanOrEqual(50);
    expect(new Set(a.map((p) => p.proto)).size).toBeGreaterThanOrEqual(6);
    expect(sceneryPlacements(track, def)).toEqual(a);
  });

  it("ninguna pieza pisa la calzada, el muro ni otra pista (huella + 5 m), ni el asfalto pintado, ni otra pieza", async () => {
    const { def, track } = await desvan();
    const list = sceneryPlacements(track, def);
    const wall = track.width / 2 + track.verge;
    for (const p of list) {
      const c = closestPoint(track, p.x, p.z);
      expect(Math.abs(c.lateral), `${p.proto} (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`).toBeGreaterThanOrEqual(wall + 5 + p.radius - 1e-6);
      expect(p.axisDistance).toBeCloseTo(Math.abs(c.lateral), 6);
    }
    for (const area of def.paint ?? []) {
      for (const p of list) for (const v of area.points) expect(Math.hypot(p.x - v.x, p.z - v.z)).toBeGreaterThan(p.radius);
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        expect(Math.hypot(list[i]!.x - list[j]!.x, list[i]!.z - list[j]!.z)).toBeGreaterThanOrEqual(list[i]!.radius + list[j]!.radius);
      }
    }
  });
});
