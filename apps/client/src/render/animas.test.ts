import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TRACKS, buildTrackFromDef, closestPoint, pointAt, surfaceY } from "@derrape/shared";
import { ANIMAS_GROUND_Y, campanarioGeometry, flightCorridorMinY, jawLocalGeometry, lagoonShape, terrainHeightField, terrainMeshes, triangleCount } from "./animas";
import { THEMES } from "./themes";
import { createKartModel } from "./kartModel";

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


async function lagunaTrack() {
  const def = await TRACKS.find((t) => t.id === "laguna-de-las-animas")!.load();
  return buildTrackFromDef(def);
}

function lowestVergeY(track: ReturnType<typeof buildTrackFromDef>) {
  let min = Infinity;
  for (const p of track.points) {
    const edge = p.w / 2 + track.verge;
    min = Math.min(min, surfaceY({ y: p.y, lateral: edge, bank: p.bank }), surfaceY({ y: p.y, lateral: -edge, bank: p.bank }));
  }
  return min;
}

function animasHeight(track: ReturnType<typeof buildTrackFromDef>) {
  const big = track.zones.find((z) => z.type === "ramp" && z.size === "L")!;
  let low = Infinity;
  for (let d = big.from - 6; d <= big.to + 50; d += 2) {
    const p = pointAt(track, d);
    low = Math.min(low, p.y, surfaceY({ y: p.y, lateral: p.width / 2, bank: p.bank }), surfaceY({ y: p.y, lateral: -p.width / 2, bank: p.bank }));
  }
  const waterY = low - 1.8;
  const spot = pointAt(track, 92, 16);
  const road = pointAt(track, 92, 0);
  const lip2 = pointAt(track, big.to);
  const mid = { x: (spot.x + lip2.x) / 2 - 2, z: Math.max(spot.z, lip2.z) + 15 };
  return terrainHeightField(track, lagoonShape(mid, { x: spot.x, z: spot.z }), waterY, ANIMAS_GROUND_Y, { x: spot.x, z: spot.z, top: road.y - 6 });
}

describe("suelo de Ánimas", () => {
  it("el plano del tema queda por debajo del arcén más bajo (el peralte lo hunde más de -8 m)", async () => {
    const track = await lagunaTrack();
    const low = lowestVergeY(track);
    expect(low).toBeLessThan(-8);
    expect(ANIMAS_GROUND_Y).toBeLessThan(low - 1);
    expect(THEMES.animas.track.groundY).toBe(ANIMAS_GROUND_Y);
  });

  it("el terreno no atraviesa la calzada ni el arcén, ni en la curva peraltada", async () => {
    const track = await lagunaTrack();
    const height = animasHeight(track);
    const chunks = terrainMeshes(height, ANIMAS_GROUND_Y, new THREE.MeshBasicMaterial());
    const group = new THREE.Group();
    for (const m of chunks) group.add(m);
    group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 120);
    // La isleta del campanario (lateral 16, radio 7) puede tocar el arcén; la calzada no.
    const hill = pointAt(track, 92, 16);

    let worst = -Infinity;
    let at = "";
    for (let d = 0; d < track.length; d += 3) {
      const p = pointAt(track, d);
      const edge = p.width / 2 + track.verge;
      for (const lat of [0, p.width / 2, -p.width / 2, edge, -edge, 7, -7]) {
        if (Math.abs(lat) > edge + 0.01) continue;
        const pt = pointAt(track, d, lat);
        const c = closestPoint(track, pt.x, pt.z);
        const road = surfaceY(c);
        const onAsphalt = Math.abs(c.lateral) <= c.width / 2 + 0.05;
        const nearHill = Math.hypot(pt.x - hill.x, pt.z - hill.z) < 14;
        if (onAsphalt || !nearHill) {
          expect(height(pt.x, pt.z), `fn d=${d} lat=${lat}`).toBeLessThanOrEqual(road - 0.2);
        }
        ray.set(new THREE.Vector3(pt.x, 80, pt.z), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(group, true)[0];
        if (!hit) continue;
        if (!onAsphalt && nearHill) continue;
        const above = hit.point.y - road;
        if (above > worst) {
          worst = above;
          at = `d=${c.distance.toFixed(1)} lat=${c.lateral.toFixed(2)} road=${road.toFixed(3)} mesh=${hit.point.y.toFixed(3)}`;
        }
      }
    }
    expect(worst, at).toBeLessThanOrEqual(-0.05);
  });
});

describe("apoyo del kart", () => {
  it("las ruedas de Hueso y Medianoche apoyan en y=0, no bajo el suelo", () => {
    for (const [character, kart] of [
      ["lia", "hueso"],
      ["calavera-chispas", "medianoche"],
    ] as const) {
      const m = createKartModel(0xff8833, character, kart);
      m.setDetail(true);
      m.root.updateMatrixWorld(true);
      let min = Infinity;
      const v = new THREE.Vector3();
      m.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible) return;
        const pos = mesh.geometry.getAttribute("position");
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          min = Math.min(min, v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y);
        }
      });
      expect(min, kart).toBeGreaterThan(-0.02);
      expect(min, kart).toBeLessThan(0.05);
    }
  });
});
