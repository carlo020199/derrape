import { describe, expect, it } from "vitest";
import type { Mesh } from "three";
import { CHARACTERS, KARTS } from "@derrape/shared";
import { createKartModel, disposeKartModelCache, triangleCount, type KartModel } from "./kartModel";
import { buildChispas, buildLia } from "./pilots";

function modelTris(m: KartModel) {
  let kart = 0;
  let driver = 0;
  let outline = 0;
  m.root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.visible || !mesh.isMesh || mesh.name === "lejos" || mesh === m.shield) return;
    const n = triangleCount(mesh.geometry);
    if (mesh.name === "contorno") outline += n;
    else if (o.parent === m.body) kart += n;
    else driver += n;
  });
  return { kart, driver, outline };
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
        const { kart, driver, outline } = modelTris(m);
        // Presupuesto del Release 1 (CLAUDE.md): piloto + coche de cerca ≤ 10 000; el contorno se mide aparte (≤ 2×).
        expect(kart + driver, `${c.id}+${k.id} de cerca`).toBeLessThanOrEqual(10000);
        expect(outline, `${c.id}+${k.id} contorno`).toBeLessThanOrEqual(2 * (kart + driver));
        m.setDetail(false);
        expect(visibleTris(m), `${c.id}+${k.id} lejos`).toBeLessThanOrEqual(1500);
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

  it("Release 1: Lía + Hueso y Calavera Chispas + Medianoche (piloto 3-5k, coche 4-6k)", () => {
    for (const [c, k] of [["lia", "hueso"], ["calavera-chispas", "medianoche"]] as const) {
      const m = createKartModel(0xff6a1f, c, k);
      const { kart, driver } = modelTris(m);
      expect(driver, `${c} piloto`).toBeGreaterThanOrEqual(3000);
      expect(driver, `${c} piloto`).toBeLessThanOrEqual(5500);
      expect(kart, `${k} coche`).toBeGreaterThanOrEqual(3500);
      expect(kart, `${k} coche`).toBeLessThanOrEqual(6000);
      expect(m.exhausts).toHaveLength(2);
    }
    // Medianoche tiene dos faros con halo; Hueso, ninguno.
    expect(createKartModel(0xff6a1f, "calavera-chispas", "medianoche").lamps).toHaveLength(2);
    expect(createKartModel(0xff6a1f, "lia", "hueso").lamps).toHaveLength(0);
  });

  it("C8: la cabeza mide entre el 45 y el 50 % del piloto sentado", () => {
    for (const p of [buildLia(), buildChispas()]) {
      const ratio = p.proportions.skull / p.proportions.seated;
      expect(ratio).toBeGreaterThanOrEqual(0.45);
      expect(ratio).toBeLessThanOrEqual(0.5);
    }
  });

  it("la coleta de Lía se balancea y el cuerpo se inclina al girar (±12°)", () => {
    const m = createKartModel(0xff6a1f, "lia", "hueso");
    let h = 0;
    for (let i = 0; i < 60; i++) {
      h += 0.04; // giro sostenido a la izquierda
      m.animate(h, 1 / 60, false, i / 60);
      m.setMood("idle", i / 60);
    }
    const driver = m.head.parent!;
    expect(Math.abs(driver.rotation.z)).toBeGreaterThan(0.05);
    expect(Math.abs(driver.rotation.z)).toBeLessThanOrEqual((12 * Math.PI) / 180 + 1e-6);
    expect(Math.abs(m.head.rotation.y)).toBeGreaterThan(0.05);
    expect(m.ornaments.length).toBeGreaterThan(0);
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
