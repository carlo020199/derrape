import * as THREE from "three";
import type { Track } from "@derrape/shared";

// Malla provisional de la pista: asfalto, bordillos y muros a partir de la línea central.
export function createTrackMesh(track: Track): THREE.Group {
  const group = new THREE.Group();
  const pts = track.points;
  const n = pts.length;
  const half = track.width / 2;

  // Normal izquierda en cada punto (media de los segmentos vecinos).
  const left = pts.map((_, i) => {
    const prev = pts[(i - 1 + n) % n]!;
    const next = pts[(i + 1) % n]!;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: dz / len, z: -dx / len };
  });

  function strip(inner: number, outer: number, y: number, colorA: number, colorB?: number) {
    const pos: number[] = [];
    const col: number[] = [];
    const ca = new THREE.Color(colorA);
    const cb = new THREE.Color(colorB ?? colorA);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p = [pts[i]!, pts[j]!];
      const l = [left[i]!, left[j]!];
      const v = (k: 0 | 1, off: number) => [p[k]!.x + l[k]!.x * off, y, p[k]!.z + l[k]!.z * off];
      const quad = [v(0, inner), v(0, outer), v(1, outer), v(0, inner), v(1, outer), v(1, inner)];
      const c = i % 2 === 0 ? ca : cb;
      for (const q of quad) {
        pos.push(...q);
        col.push(c.r, c.g, c.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  }

  group.add(strip(-half, half, 0.01, 0x4a4e5a));
  group.add(strip(half - 0.8, half, 0.02, 0xe8e8e8, 0xd6402f));
  group.add(strip(-half, -half + 0.8, 0.02, 0xe8e8e8, 0xd6402f));
  // Línea de salida.
  const start = new THREE.Mesh(
    new THREE.PlaneGeometry(track.width, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  start.rotation.x = -Math.PI / 2;
  start.rotation.z = Math.atan2(left[0]!.x, left[0]!.z) + Math.PI / 2;
  start.position.set(pts[0]!.x, 0.03, pts[0]!.z);
  group.add(start);

  // Muros bajos en ambos bordes.
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x2e86de });
  for (const side of [-1, 1]) {
    const pos: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = pts[i]!.x + left[i]!.x * half * side;
      const az = pts[i]!.z + left[i]!.z * half * side;
      const bx = pts[j]!.x + left[j]!.x * half * side;
      const bz = pts[j]!.z + left[j]!.z * half * side;
      pos.push(ax, 0, az, bx, 0, bz, bx, 0.8, bz, ax, 0, az, bx, 0.8, bz, ax, 0.8, az);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: wallMat.color, side: THREE.DoubleSide })));
  }

  return group;
}
