import * as THREE from "three";
import type { Track } from "@derrape/shared";
import { PALETTE, markShared, sharedVertexToonDouble } from "./materials";

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
  /** Si viene, los bordillos miden esto (m) y se pintan sin apagarse. Si no, el ancho de siempre. */
  curbWidth?: number;
  /** Línea central, un poco más clara que el asfalto. */
  racingLine?: number;
  /** Filete emisivo en el borde alto de las curvas peraltadas. */
  bankEdge?: boolean;
}

let vivid: THREE.MeshBasicMaterial | null = null;
/** Bordillos y filete que no se apagan con el toon: el color es el de la paleta. */
function vividRoad() {
  if (!vivid) vivid = markShared(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  return vivid;
}

/** Filete Espectro en el borde alto, solo donde hay peralte. */
function bankEdge(
  group: THREE.Group,
  track: Track,
  left: { x: number; z: number }[],
  heightAt: (k: number, lateral: number, lift: number) => number,
) {
  const pts = track.points;
  const pos: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const bi = pts[i]!.bank ?? 0;
    const bj = pts[j]!.bank ?? 0;
    if (Math.abs(bi) < 12 && Math.abs(bj) < 12) continue;
    const side = (b: number) => (b >= 0 ? -1 : 1);
    const quad = (k: number, bank: number) => {
      const w = pts[k]!.w;
      const sign = side(bank);
      const inner = sign * (w / 2 - 0.16);
      const outer = sign * (w / 2 + 0.02);
      return [
        [pts[k]!.x + left[k]!.x * inner, heightAt(k, inner, 0.14), pts[k]!.z + left[k]!.z * inner],
        [pts[k]!.x + left[k]!.x * outer, heightAt(k, outer, 0.14), pts[k]!.z + left[k]!.z * outer],
      ];
    };
    const a = quad(i, bi);
    const b = quad(j, bj || bi);
    for (const v of [a[0], a[1], b[1], a[0], b[1], b[0]]) pos.push(...v!);
  }
  if (pos.length === 0) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: PALETTE.espectro, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  mesh.name = "filete-peralte";
  mesh.renderOrder = 1;
  group.add(mesh);
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
   * Altura de la calzada en un borde. Con peralte 0 es la línea central más el realce,
   * igual que antes. El talud puede anclarse al suelo (`ground`).
   */
  const heightAt = (k: number, lateral: number, lift: number, ground = false) => {
    if (ground) return colors.groundY;
    const p = pts[k]!;
    const bank = ((p.bank ?? 0) * Math.PI) / 180;
    return p.y - lateral * Math.tan(bank) + lift;
  };
  /** Bordillo más ancho y más alto donde el peralte se lee en el móvil. En llano, 0,9 m y +0,04. */
  const fixedCurb = colors.curbWidth;
  const curb = (bank: number) => (fixedCurb != null ? fixedCurb : Math.abs(bank) >= 12 ? 1.45 : 0.9);
  const curbLift = (bank: number) => (fixedCurb != null ? 0.08 : Math.abs(bank) >= 12 ? 0.1 : 0.04);
  const curbMat = fixedCurb != null ? vividRoad() : sharedVertexToonDouble();
  const curbEvery = fixedCurb != null ? 4 : 1;
  type Lift = number | ((bank: number) => number);
  const liftOf = (lift: Lift, bank: number) => (typeof lift === "number" ? lift : lift(bank));

  /**
   * Una tira a lo largo de toda la pista. `inner`/`outer` = desplazamiento lateral.
   * `liftIn`/`liftOut` se suman a la superficie peraltada. `groundOut` ancla ese borde al suelo.
   */
  function strip(
    inner: (w: number, bank: number) => number,
    outer: (w: number, bank: number) => number,
    colorA: number,
    colorB = colorA,
    liftIn: Lift = 0,
    liftOut: Lift = 0,
    groundIn = false,
    groundOut = false,
    every = 1,
    mat: THREE.Material = sharedVertexToonDouble(),
  ) {
    const pos: number[] = [];
    const col: number[] = [];
    const ca = new THREE.Color(colorA);
    const cb = new THREE.Color(colorB);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const vert = (k: number, off: number, lift: number, ground: boolean) => [
        pts[k]!.x + left[k]!.x * off,
        heightAt(k, off, lift, ground),
        pts[k]!.z + left[k]!.z * off,
      ];
      const bi = pts[i]!.bank ?? 0;
      const bj = pts[j]!.bank ?? 0;
      const a0 = vert(i, inner(pts[i]!.w, bi), liftOf(liftIn, bi), groundIn);
      const a1 = vert(i, outer(pts[i]!.w, bi), liftOf(liftOut, bi), groundOut);
      const b0 = vert(j, inner(pts[j]!.w, bj), liftOf(liftIn, bj), groundIn);
      const b1 = vert(j, outer(pts[j]!.w, bj), liftOf(liftOut, bj), groundOut);
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
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    return mesh;
  }

  const v = track.verge;

  // Asfalto y bordillos. En llano el realce es el de siempre (0,02 / 0,04).
  strip((w) => -w / 2, (w) => w / 2, colors.road, colors.road, 0.02, 0.02);
  strip((w, b) => w / 2 - curb(b), (w) => w / 2, colors.curbA, colors.curbB, curbLift, curbLift, false, false, curbEvery, curbMat);
  strip((w, b) => -w / 2, (w, b) => -w / 2 + curb(b), colors.curbA, colors.curbB, curbLift, curbLift, false, false, curbEvery, curbMat);
  if (colors.racingLine != null) {
    strip(() => -0.26, () => 0.26, colors.racingLine, colors.racingLine, 0.05, 0.05, false, false, 1, vividRoad());
  }
  if (colors.bankEdge) bankEdge(group, track, left, heightAt);
  // Arcén.
  if (v > 0) {
    strip((w) => w / 2, (w) => w / 2 + v, colors.verge);
    strip((w) => -w / 2 - v, (w) => -w / 2, colors.verge);
  }
  // Muros bajos en el borde exterior del arcén, con tapa de hueso.
  strip((w) => w / 2 + v, (w) => w / 2 + v, colors.wall, colors.wall, 0.9, 0);
  strip((w) => -w / 2 - v, (w) => -w / 2 - v, colors.wall, colors.wall, 0.9, 0);
  strip((w) => w / 2 + v - 0.16, (w) => w / 2 + v + 0.16, PALETTE.hueso, PALETTE.hueso, 0.96, 0.96);
  strip((w) => -w / 2 - v - 0.16, (w) => -w / 2 - v + 0.16, PALETTE.hueso, PALETTE.hueso, 0.96, 0.96);
  // Talud desde el borde (ya peraltado) hasta el suelo.
  strip((w) => w / 2 + v, (w) => w / 2 + v + 6, colors.verge, colors.verge, 0, 0, false, true);
  strip((w) => -w / 2 - v - 6, (w) => -w / 2 - v, colors.verge, colors.verge, 0, 0, true, false);

  // Línea de salida a cuadros.
  const checker = document.createElement("canvas");
  checker.width = 16;
  checker.height = 2;
  const g = checker.getContext("2d")!;
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#F3E7D3" : "#120F1E";
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
