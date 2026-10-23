import * as THREE from "three";
import type { Track } from "@derrape/shared";

// Malla de la pista generada a partir de la línea central: asfalto, bordillos, arcén,
// muros y talud hasta el suelo (para los tramos elevados).

export interface TrackColors {
  road: number;
  curbA: number;
  curbB: number;
  verge: number;
  wall: number;
  /** Altura del suelo alrededor. */
  groundY: number;
}

/** Normal izquierda (dz, -dx) en cada punto, media de los segmentos vecinos. */
export function leftNormals(track: Track) {
  const pts = track.points;
  const n = pts.length;
  return pts.map((_, i) => {
    const prev = pts[(i - 1 + n) % n]!;
    const next = pts[(i + 1) % n]!;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: dz / len, z: -dx / len };
  });
}

export function createTrackMesh(track: Track, colors: TrackColors): THREE.Group {
  const group = new THREE.Group();
  const pts = track.points;
  const n = pts.length;
  const left = leftNormals(track);

  /**
   * Una tira a lo largo de toda la pista. `inner`/`outer` = desplazamiento lateral en función del
   * ancho del punto; `yIn`/`yOut` = altura relativa a la pista en cada borde.
   */
  function strip(
    inner: (w: number) => number,
    outer: (w: number) => number,
    colorA: number,
    colorB = colorA,
    yIn = (y: number) => y,
    yOut = (y: number) => y,
    every = 1,
  ) {
    const pos: number[] = [];
    const col: number[] = [];
    const ca = new THREE.Color(colorA);
    const cb = new THREE.Color(colorB);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const vert = (k: number, off: number, y: number) => [pts[k]!.x + left[k]!.x * off, y, pts[k]!.z + left[k]!.z * off];
      const a0 = vert(i, inner(pts[i]!.w), yIn(pts[i]!.y));
      const a1 = vert(i, outer(pts[i]!.w), yOut(pts[i]!.y));
      const b0 = vert(j, inner(pts[j]!.w), yIn(pts[j]!.y));
      const b1 = vert(j, outer(pts[j]!.w), yOut(pts[j]!.y));
      const c = Math.floor(i / every) % 2 === 0 ? ca : cb;
      for (const v of [a0, a1, b1, a0, b1, b0]) {
        pos.push(...v);
        col.push(c.r, c.g, c.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    group.add(mesh);
    return mesh;
  }

  const v = track.verge;
  const lift = (h: number) => (y: number) => y + h;
  const ground = () => colors.groundY;

  // Asfalto y bordillos.
  strip((w) => -w / 2, (w) => w / 2, colors.road, colors.road, lift(0.02), lift(0.02));
  strip((w) => w / 2 - 0.9, (w) => w / 2, colors.curbA, colors.curbB, lift(0.04), lift(0.04));
  strip((w) => -w / 2, (w) => -w / 2 + 0.9, colors.curbA, colors.curbB, lift(0.04), lift(0.04));
  // Arcén.
  if (v > 0) {
    strip((w) => w / 2, (w) => w / 2 + v, colors.verge);
    strip((w) => -w / 2 - v, (w) => -w / 2, colors.verge);
  }
  // Muros bajos en el borde exterior del arcén.
  strip((w) => w / 2 + v, (w) => w / 2 + v, colors.wall, colors.wall, lift(0.9), lift(0));
  strip((w) => -w / 2 - v, (w) => -w / 2 - v, colors.wall, colors.wall, lift(0.9), lift(0));
  // Talud desde el muro hasta el suelo (solo se nota donde la pista está elevada).
  strip((w) => w / 2 + v, (w) => w / 2 + v + 6, colors.verge, colors.verge, (y) => y, ground);
  strip((w) => -w / 2 - v - 6, (w) => -w / 2 - v, colors.verge, colors.verge, ground, (y) => y);

  // Línea de salida a cuadros.
  const checker = document.createElement("canvas");
  checker.width = 16;
  checker.height = 2;
  const g = checker.getContext("2d")!;
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#ffffff" : "#1b1b1b";
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(checker);
  tex.magFilter = THREE.NearestFilter;
  const start = new THREE.Mesh(new THREE.PlaneGeometry(pts[0]!.w, 1.6), new THREE.MeshBasicMaterial({ map: tex }));
  start.rotation.x = -Math.PI / 2;
  start.rotation.z = Math.atan2(left[0]!.x, left[0]!.z) + Math.PI / 2;
  start.position.set(pts[0]!.x, pts[0]!.y + 0.05, pts[0]!.z);
  group.add(start);

  return group;
}
