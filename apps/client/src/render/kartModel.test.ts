import { describe, expect, it } from "vitest";
import type { Mesh } from "three";
import { CHARACTERS, KARTS } from "@derrape/shared";
import { createKartModel, disposeKartModelCache, triangleCount, type KartModel } from "./kartModel";

function modelTris(m: KartModel) {
  let kart = 0;
  let driver = 0;
  m.root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.visible || !mesh.isMesh || mesh.name === "contorno" || mesh.name === "lejos" || mesh === m.shield) return;
    const n = triangleCount(mesh.geometry);
    if (o.parent === m.body) kart += n;
    else driver += n;
  });
  return { kart, driver };
}

function onScreen(o: Mesh) {
  let p: Mesh["parent"] = o;
  while (p) {
    if (!p.visible) return false;
    p = p.parent;
  }
  return true;
}

function visibleTris(m: KartModel) {
  let n = 0;
  m.root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || mesh.name === "contorno" || mesh === m.shield || !onScreen(mesh)) return;
    n += triangleCount(mesh.geometry);
  });
  return n;
}

describe("pilotos y karts redondeados", () => {
  it("cada pareja cabe en el presupuesto y el piloto lleva contorno por escala", () => {
    for (const c of CHARACTERS) {
      for (const k of KARTS) {
        const m = createKartModel(0xff6a1f, c.id, k.id);
        const { kart, driver } = modelTris(m);
        expect(kart + driver, `${c.id}+${k.id} de cerca`).toBeLessThanOrEqual(1800);
        m.setDetail(false);
        expect(visibleTris(m), `${c.id}+${k.id} lejos`).toBeLessThanOrEqual(600);
        m.setDetail(true);
        const shells: Mesh[] = [];
        m.root.traverse((o) => {
          if (o.name === "contorno") shells.push(o as Mesh);
        });
        expect(shells.length).toBeGreaterThanOrEqual(2);
        for (const s of shells) expect(s.scale.x).toBeCloseTo(1.04);
        expect(m.exhausts.length).toBeGreaterThan(0);
        for (const e of m.exhausts) expect(e.position.z).toBeLessThan(0.2);
      }
    }
    disposeKartModelCache();
  });

  it("los pesados llevan 4 escapes y Derrapín los lleva juntos", () => {
    const tanque = createKartModel(0xff6a1f, "toni", "tanque");
    const furgo = createKartModel(0xff6a1f, "toni", "furgo");
    const derrapin = createKartModel(0xff6a1f, "lia", "derrapin");
    expect(tanque.exhausts).toHaveLength(4);
    expect(furgo.exhausts).toHaveLength(4);
    expect(derrapin.exhausts).toHaveLength(2);
    expect(Math.abs(derrapin.exhausts[0]!.position.x)).toBeLessThan(0.2);
    expect(Math.abs(derrapin.exhausts[1]!.position.x)).toBeLessThan(0.2);
  });

  it("la cabeza es grande respecto al cuerpo y celebrar la estira", () => {
    const m = createKartModel(0xff6a1f, "lia", "chispa");
    const headY = m.head.position.y;
    expect(headY).toBeGreaterThan(0.9);
    m.setMood("celebrate", 0.2);
    m.setMood("celebrate", 0.45);
    expect(m.head.scale.y).toBeGreaterThan(1);
    expect(m.mood).toBe("celebrate");
    m.setMood("angry", 0.5);
    expect(m.mood).toBe("angry");
  });
});
