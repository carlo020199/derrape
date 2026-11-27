import { describe, expect, it } from "vitest";
import { buildTrackFromDef, closestPoint, findTrack, surfaceAt, type TrackDef } from "@derrape/shared";
import { areaFrame, layoutMotifs, paintedAreas, paintedAsphaltMesh, paintedGeometry } from "./paintedAsphalt";

async function desvan(): Promise<{ def: TrackDef; track: ReturnType<typeof buildTrackFromDef> }> {
  const def = await findTrack("desvan-de-las-maravillas")!.load();
  return { def, track: buildTrackFromDef(def) };
}

describe("asfalto pintado decorativo", () => {
  it("el Desván tiene una zona rosa y otra morada, fuera del muro con margen", async () => {
    const { def, track } = await desvan();
    const areas = paintedAreas(track, def);
    expect(areas.map((a) => a.kind).sort()).toEqual(["morada", "rosa"]);
    const wall = track.width / 2 + track.verge;
    for (const a of areas) {
      // Se muestrea todo el polígono (convexo): vértices, aristas y relleno.
      const n = a.points.length;
      const c = { x: a.points.reduce((s, p) => s + p.x, 0) / n, z: a.points.reduce((s, p) => s + p.z, 0) / n };
      for (const p of a.points) for (let t = 0; t <= 1; t += 0.1) {
        const x = c.x + (p.x - c.x) * t;
        const z = c.z + (p.z - c.z) * t;
        const cp = closestPoint(track, x, z);
        const d = Math.hypot(cp.x - x, cp.z - z);
        expect(d, `${a.kind} (${x.toFixed(1)}, ${z.toFixed(1)})`).toBeGreaterThan(wall + 2.5);
      }
    }
  });

  it("no es superficie de juego: con o sin `paint` la pista y sus superficies son idénticas", async () => {
    const { def, track } = await desvan();
    const sin = buildTrackFromDef({ ...def, paint: undefined });
    expect(track.zones).toEqual(sin.zones);
    expect(track.length).toBe(sin.length);
    for (const a of paintedAreas(track, def)) {
      const n = a.points.length;
      const x = a.points.reduce((s, p) => s + p.x, 0) / n;
      const z = a.points.reduce((s, p) => s + p.z, 0) / n;
      // Bajo la losa no hay zona nueva: sale lo mismo que sin ella (arcén, o `fall` de la plataforma, que ya existía).
      expect(surfaceAt(track, closestPoint(track, x, z))).toBe(surfaceAt(sin, closestPoint(sin, x, z)));
    }
    // Una muestra de calzada sigue siendo calzada.
    expect(surfaceAt(track, closestPoint(track, track.points[40]!.x, track.points[40]!.z))).toBe("road");
  });

  it("la losa queda por debajo del asfalto cercano, no lo tapa", async () => {
    const { def, track } = await desvan();
    for (const a of paintedAreas(track, def)) {
      for (const p of a.points) expect(a.y).toBeLessThan(closestPoint(track, p.x, p.z).y);
    }
  });

  it("geometría: una malla barata con UV dentro del atlas", async () => {
    const { def, track } = await desvan();
    const geo = paintedGeometry(paintedAreas(track, def));
    const tris = geo.getIndex()!.count / 3;
    expect(tris).toBeGreaterThan(10);
    expect(tris).toBeLessThan(100);
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getY(i)).toBeLessThanOrEqual(1);
    }
  });

  it("cada zona lleva logos de «patrocinadores» y adornos, todos dentro del polígono", async () => {
    const { def, track } = await desvan();
    for (const a of paintedAreas(track, def)) {
      const f = areaFrame(a.points);
      const motifs = layoutMotifs(a.kind, f);
      expect(motifs.filter((m) => m.kind === "logo").length).toBeGreaterThanOrEqual(2);
      expect(motifs.filter((m) => m.kind !== "logo").length).toBeGreaterThanOrEqual(4);
      expect(new Set(motifs.map((m) => m.kind)).size).toBeGreaterThanOrEqual(3);
      for (const m of motifs) {
        expect(m.u).toBeGreaterThan(0);
        expect(m.u).toBeLessThan(f.width);
        expect(m.v).toBeGreaterThan(0);
        expect(m.v).toBeLessThan(f.height);
      }
      expect(layoutMotifs(a.kind, f)).toEqual(motifs);
    }
  });

  it("los demás circuitos no pintan nada", async () => {
    const laguna = await findTrack("laguna-de-las-animas")!.load();
    expect(paintedAsphaltMesh(buildTrackFromDef(laguna), laguna)).toBeNull();
  });
});
