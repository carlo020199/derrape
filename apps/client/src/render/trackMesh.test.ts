import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { TRACKS, buildTrackFromDef } from "@derrape/shared";
import { MESH_STEP, ringDistances, squashOffset, createTrackMesh } from "./trackMesh";
import { THEMES } from "./themes";

beforeAll(() => {
  // createTrackMesh solo usa el canvas para la línea de salida.
  const g = globalThis as { document?: unknown };
  if (!g.document) {
    g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: "", fillRect() {} }) }) };
  }
});

async function build(id: string) {
  const entry = TRACKS.find((t) => t.id === id)!;
  const def = await entry.load();
  const track = buildTrackFromDef(def);
  return { track, group: createTrackMesh(track, THEMES[def.theme].track) };
}

describe("malla de la pista", () => {
  it("los anillos van como mucho cada 1 m y más juntos donde cambia el relieve", async () => {
    const { track } = await build("laguna-de-las-animas");
    const d = ringDistances(track);
    let maxGap = 0;
    let fine = 0;
    for (let i = 0; i < d.length; i++) {
      const gap = (i === d.length - 1 ? track.length : d[i + 1]!) - d[i]!;
      maxGap = Math.max(maxGap, gap);
      if (gap < MESH_STEP - 0.05) fine++;
    }
    expect(maxGap).toBeLessThanOrEqual(MESH_STEP + 0.05);
    expect(fine).toBeGreaterThan(20);
  });

  it("las normales de los vértices del asfalto no saltan más de 3° por metro", async () => {
    for (const id of ["laguna-de-las-animas", "paseo-del-puerto"]) {
      const { group } = await build(id);
      const road = group.children[0] as THREE.Mesh;
      const pos = road.geometry.getAttribute("position");
      const nor = road.geometry.getAttribute("normal");
      const idx = road.geometry.index!;
      let worst = 0;
      for (let t = 0; t < idx.count; t += 3) {
        const a = idx.getX(t);
        const b = idx.getX(t + 1);
        const c = idx.getX(t + 2);
        for (const [p, q] of [[a, b], [b, c], [a, c]] as const) {
          const na = new THREE.Vector3().fromBufferAttribute(nor, p);
          const nb = new THREE.Vector3().fromBufferAttribute(nor, q);
          const len = new THREE.Vector3().fromBufferAttribute(pos, p).distanceTo(new THREE.Vector3().fromBufferAttribute(pos, q));
          if (len < 0.3) continue;
          worst = Math.max(worst, THREE.MathUtils.radToDeg(na.angleTo(nb)) / Math.max(len, 1));
        }
      }
      expect(worst).toBeLessThanOrEqual(3);
    }
  });

  it("el asfalto no se pliega en la horquilla de Ánimas (todos los cuadriláteros miran igual)", async () => {
    const { group } = await build("laguna-de-las-animas");
    const road = group.children[0] as THREE.Mesh;
    const pos = road.geometry.getAttribute("position");
    const idx = road.geometry.index!;
    let positive = 0;
    let negative = 0;
    for (let t = 0; t < idx.count; t += 3) {
      const [a, b, c] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      const area = (pos.getX(b) - pos.getX(a)) * (pos.getZ(c) - pos.getZ(a)) - (pos.getZ(b) - pos.getZ(a)) * (pos.getX(c) - pos.getX(a));
      if (area > 1e-6) positive++;
      else if (area < -1e-6) negative++;
    }
    // Solo la costura de cierre de vuelta puede dar la vuelta; ninguna cara más.
    expect(Math.min(positive, negative)).toBeLessThanOrEqual(2);
  });

  it("squashOffset no toca el lado exterior ni los desplazamientos pequeños y no cruza el centro de curvatura", () => {
    expect(squashOffset(8, -1 / 7)).toBe(8);
    expect(squashOffset(2, 1 / 40)).toBe(2);
    const radius = 7;
    for (let o = 0; o <= 20; o += 0.5) expect(squashOffset(o, 1 / radius)).toBeLessThan(radius * 0.9 + 1e-9);
    expect(squashOffset(9, 1 / radius)).toBeGreaterThan(squashOffset(5, 1 / radius));
  });
});
