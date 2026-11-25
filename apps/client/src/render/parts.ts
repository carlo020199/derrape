import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Utilidades para construir pilotos y coches con primitivas: todo con color por vértice, fusionado en una malla.

export type Vec3 = [number, number, number];

/** Acumula piezas y las fusiona en una sola geometría con color por vértice. */
export class Parts {
  private list: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(geo: THREE.BufferGeometry, color: number, pos: Vec3, rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    if (src !== geo) geo.dispose();
    this.m.compose(new THREE.Vector3(...pos), this.q.setFromEuler(this.e.set(...rot)), new THREE.Vector3(...scale));
    src.applyMatrix4(this.m);
    const c = new THREE.Color(color);
    const n = src.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    src.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.list.push(src);
    return this;
  }

  ball(r: number, color: number, pos: Vec3, scale?: Vec3, seg: [number, number] = [6, 5]) {
    return this.add(new THREE.SphereGeometry(r, seg[0], seg[1]), color, pos, [0, 0, 0], scale);
  }

  dome(r: number, color: number, pos: Vec3, scale?: Vec3) {
    return this.add(new THREE.SphereGeometry(r, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), color, pos, [0, 0, 0], scale);
  }

  capsule(radius: number, length: number, color: number, pos: Vec3, rot?: Vec3, scale?: Vec3, radial = 5) {
    return this.add(new THREE.CapsuleGeometry(radius, length, 1, radial), color, pos, rot, scale);
  }

  cyl(rTop: number, rBot: number, h: number, color: number, pos: Vec3, rot?: Vec3) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, 5), color, pos, rot);
  }

  torus(r: number, tube: number, color: number, pos: Vec3, rot?: Vec3, arc = Math.PI * 2) {
    return this.add(new THREE.TorusGeometry(r, tube, 3, 8, arc), color, pos, rot);
  }

  cone(r: number, h: number, color: number, pos: Vec3, rot?: Vec3) {
    const g = new THREE.ConeGeometry(r, h, 5);
    g.translate(0, h / 2, 0);
    return this.add(g, color, pos, rot);
  }

  rounded(w: number, h: number, d: number, color: number, pos: Vec3, rot?: Vec3, radius = 0.1) {
    const rad = Math.min(radius, w / 2, h / 2, d / 2);
    return this.add(new RoundedBoxGeometry(w, h, d, 1, Math.max(0.02, rad)), color, pos, rot);
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.list, false);
    for (const g of this.list) g.dispose();
    if (!merged) throw new Error("no se pudo fusionar la malla");
    // No recomputar normales: en una malla sin índices cada triángulo quedaría plano
    // y la esfera de 20×14 se vería como una cabeza facetada.
    if (!merged.getAttribute("normal")) merged.computeVertexNormals();
    return merged;
  }
}

export const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

