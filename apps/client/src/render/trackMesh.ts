import * as THREE from "three";
import { roadFrameAt, roadNormal, type RoadFrame, type Track } from "@derrape/shared";
import { PALETTE, animasAsphaltLineMaterial, animasAsphaltMaterial, markShared, sharedVertexToonDouble } from "./materials";

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
  /** Trazos de hueso sobre la línea central. Van en esa misma malla: no añaden una llamada. */
  centreDash?: { color: number; opacity: number; length: number; period: number };
  /** Bordillo interior (lado bajo) en las curvas. El exterior sigue en curbA/curbB. */
  innerCurbA?: number;
  innerCurbB?: number;
  /** Asfalto con su propia rampa de toon y un emisivo bajo. Solo Ánimas. */
  animasAsphalt?: boolean;
  /** Línea Espectro (0,15 m) en los dos bordes de la calzada, antes del bordillo. */
  bankEdge?: boolean;
}

let vivid: THREE.MeshBasicMaterial | null = null;
/** Bordillos y filete que no se apagan con el toon: el color es el de la paleta. */
function vividRoad() {
  if (!vivid) vivid = markShared(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  return vivid;
}

/**
 * Línea Espectro de 0,15 m en el borde de la calzada, justo antes del bordillo, a los dos lados y en toda
 * la vuelta (en las curvas peraltadas es la que se ve en el borde exterior). Una sola malla.
 */
function bankEdge(
  group: THREE.Group,
  track: Track,
  left: { x: number; z: number }[],
  heightAt: (k: number, lateral: number, lift: number) => number,
  kappa: number[],
  curbWidth: number,
) {
  const pts = track.points;
  const pos: number[] = [];
  for (const sign of [1, -1]) {
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const quad = (k: number) => {
        const w = pts[k]!.w;
        const inner = sign * (w / 2 - curbWidth - 0.15);
        const outer = sign * (w / 2 - curbWidth);
        const oi = squashOffset(inner, kappa[k]!);
        const oo = squashOffset(outer, kappa[k]!);
        return [
          [pts[k]!.x + left[k]!.x * oi, heightAt(k, inner, 0.07), pts[k]!.z + left[k]!.z * oi],
          [pts[k]!.x + left[k]!.x * oo, heightAt(k, outer, 0.07), pts[k]!.z + left[k]!.z * oo],
        ];
      };
      const a = quad(i);
      const b = quad(j);
      for (const v of [a[0], a[1], b[1], a[0], b[1], b[0]]) pos.push(...v!);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: PALETTE.espectro, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  mesh.name = "linea-espectro";
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

/** Separación base de los anillos de la calzada (m) y la fina donde cambian la pendiente o el peralte. */
export const MESH_STEP = 1;
export const MESH_STEP_FINE = 0.5;

interface Ring extends RoadFrame {
  d: number;
  /** Curvatura en planta con signo (1/m): + = gira a la izquierda. */
  kappa: number;
}

function ringAt(track: Track, d: number): Ring {
  const f = roadFrameAt(track, d);
  const a = roadFrameAt(track, d - 1.5).heading;
  const b = roadFrameAt(track, d + 1.5).heading;
  let dh = b - a;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  return { ...f, d, kappa: dh / 3 };
}

/**
 * Distancias de los anillos: cada `MESH_STEP` m, y cada `MESH_STEP_FINE` donde la pendiente o el peralte
 * cambian de ritmo (curvas verticales, entradas y salidas de peralte).
 */
export function ringDistances(track: Track): number[] {
  const half = MESH_STEP_FINE;
  const count = Math.round(track.length / half);
  const step = track.length / count;
  const f = Array.from({ length: count + 2 }, (_, i) => roadFrameAt(track, (i - 1) * step));
  const active = (i: number) => {
    const a = f[i]!;
    const b = f[i + 1]!;
    const c = f[i + 2]!;
    const dGrade = Math.abs(c.grade - 2 * b.grade + a.grade) / (step * step);
    const dBank = Math.abs(c.bank - 2 * b.bank + a.bank) / (step * step);
    return dGrade > 0.004 || dBank > 0.05;
  };
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    // Un anillo cada 2 muestras (1 m); el intermedio solo si hay cambio de ritmo cerca.
    if (i % 2 === 0 || active(i) || active(Math.max(0, i - 1)) || active(Math.min(count - 1, i + 1))) out.push(i * step);
  }
  return out;
}

/**
 * Comprime el desplazamiento lateral en el lado interior de una curva cerrada: pasado el 50 % del radio
 * se acerca despacio al 90 %, así el borde no cruza el centro de curvatura y no se pliega.
 */
export function squashOffset(offset: number, kappa: number): number {
  if (kappa * offset <= 0) return offset;
  const radius = 1 / Math.abs(kappa);
  const a = radius * 0.5;
  const e = Math.abs(offset);
  if (e <= a) return offset;
  const b = radius * 0.9;
  return Math.sign(offset) * (a + (b - a) * (1 - Math.exp(-(e - a) / (b - a))));
}

export function createTrackMesh(track: Track, colors: TrackColors): THREE.Group {
  const group = new THREE.Group();
  const pts = track.points;
  const n = pts.length;
  const left = leftNormals(track);
  const nodeKappa = pts.map((_, k) => ringAt(track, track.lengths[k]!).kappa);

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
    colorOf?: (segment: number, bank: number) => THREE.Color,
  ) {
    const pos: number[] = [];
    const col: number[] = [];
    const ca = new THREE.Color(colorA);
    const cb = new THREE.Color(colorB);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const vert = (k: number, off: number, lift: number, ground: boolean) => {
        const o = squashOffset(off, nodeKappa[k]!);
        return [pts[k]!.x + left[k]!.x * o, heightAt(k, off, lift, ground), pts[k]!.z + left[k]!.z * o];
      };
      const bi = pts[i]!.bank ?? 0;
      const bj = pts[j]!.bank ?? 0;
      const a0 = vert(i, inner(pts[i]!.w, bi), liftOf(liftIn, bi), groundIn);
      const a1 = vert(i, outer(pts[i]!.w, bi), liftOf(liftOut, bi), groundOut);
      const b0 = vert(j, inner(pts[j]!.w, bj), liftOf(liftIn, bj), groundIn);
      const b1 = vert(j, outer(pts[j]!.w, bj), liftOf(liftOut, bj), groundOut);
      const c = colorOf ? colorOf(i, bi) : Math.floor(i / every) % 2 === 0 ? ca : cb;
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


  // Anillos finos de la calzada, compartidos por todas las tiras de superficie.
  const baseRings = ringDistances(track).map((d) => ringAt(track, d));
  const extra = new Map<number, Ring>();
  const ringFor = (d: number) => {
    const key = Math.round(d * 1000);
    let r = extra.get(key);
    if (!r) extra.set(key, (r = ringAt(track, d)));
    return r;
  };

  /**
   * Tira de superficie con geometría indexada y normales analíticas (pendiente + peralte):
   * el toon no muestra escalones entre segmentos. `breaks` son distancias donde cambia el color
   * y donde se duplican los vértices.
   */
  function roadStrip(
    inner: (w: number, bank: number) => number,
    outer: (w: number, bank: number) => number,
    liftIn: Lift,
    liftOut: Lift,
    colorAt: (d: number, bank: number) => THREE.Color,
    mat: THREE.Material,
    breaks: number[] = [],
    roadCoords = false,
    /** Tramos (distancia media del segmento) donde no se dibuja la tira: p. ej. el arcén bajo una plataforma. */
    skip?: (d: number) => boolean,
  ) {
    const rings: Ring[] = baseRings.slice();
    for (const b of breaks) if (b > 0 && b < track.length) rings.push(ringFor(b));
    rings.sort((p, q) => p.d - q.d);
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const roadAttr: number[] = [];
    // `dist` es la distancia a lo largo de la pista (en el último tramo sigue creciendo en vez de volver a 0).
    const emit = (r: Ring, c: THREE.Color, dist: number) => {
      const n = roadNormal(r.heading, r.grade, r.bank);
      const lx = Math.cos(r.heading);
      const lz = -Math.sin(r.heading);
      const base = pos.length / 3;
      for (const [off, lift] of [
        [inner(r.width, r.bank), liftOf(liftIn, r.bank)],
        [outer(r.width, r.bank), liftOf(liftOut, r.bank)],
      ] as const) {
        const o = squashOffset(off, r.kappa);
        pos.push(r.x + lx * o, r.y - off * Math.tan((r.bank * Math.PI) / 180) + lift, r.z + lz * o);
        nor.push(n.x, n.y, n.z);
        col.push(c.r, c.g, c.b);
        roadAttr.push(off, dist, r.width / 2);
      }
      return base;
    };
    const total = rings.length;
    let prevColor: THREE.Color | null = null;
    let prevBase = 0;
    for (let k = 0; k < total; k++) {
      const a = rings[k]!;
      const b = rings[(k + 1) % total]!;
      const dB = k === total - 1 ? track.length + b.d : b.d;
      if (skip?.((a.d + dB) / 2)) {
        prevColor = null;
        continue;
      }
      const c = colorAt((a.d + dB) / 2, (a.bank + b.bank) / 2);
      const aBase = prevColor && prevColor.equals(c) ? prevBase : emit(a, c, a.d);
      const bBase = emit(b, c, dB);
      // Mismo orden de caras que antes: (a0, a1, b1) y (a0, b1, b0).
      idx.push(aBase, aBase + 1, bBase + 1, aBase, bBase + 1, bBase);
      prevColor = c;
      prevBase = bBase;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    // Metros desde el eje, distancia recorrida y semiancho: el asfalto pinta rodadas y borde oscuro con ellos.
    if (roadCoords) geo.setAttribute("aRoad", new THREE.Float32BufferAttribute(roadAttr, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    return mesh;
  }
  const flat = (c: THREE.Color) => () => c;
  const stripeLen = (every: number) => (every * track.length) / n;
  const multiples = (len: number, offset = 0) => {
    const out: number[] = [];
    for (let d = offset; d < track.length; d += len) out.push(d);
    return out;
  };

  const v = track.verge;

  // Asfalto y bordillos. En llano el realce es el de siempre (0,02 / 0,04).
  const roadMat = colors.animasAsphalt ? animasAsphaltMaterial() : sharedVertexToonDouble();
  roadStrip((w) => -w / 2, (w) => w / 2, 0.02, 0.02, flat(new THREE.Color(colors.road)), roadMat, [], !!colors.animasAsphalt);
  const innerA = colors.innerCurbA != null ? new THREE.Color(colors.innerCurbA) : null;
  const innerB = colors.innerCurbB != null ? new THREE.Color(colors.innerCurbB) : null;
  const curbA = new THREE.Color(colors.curbA);
  const curbB = new THREE.Color(colors.curbB);
  const curbLen = stripeLen(curbEvery);
  const curbColor = (side: number) => (d: number, bank: number) => {
    const high = bank >= 0 ? -1 : 1;
    const outer = innerA == null || Math.abs(bank) < 8 || Math.sign(side) === high || Math.sign(bank) === 0;
    const pair = outer ? [curbA, curbB] : [innerA!, innerB ?? innerA!];
    return pair[Math.floor(d / curbLen) % 2]!;
  };
  roadStrip((w, b) => w / 2 - curb(b), (w) => w / 2, curbLift, curbLift, curbColor(1), curbMat, multiples(curbLen));
  roadStrip((w, _b) => -w / 2, (w, b) => -w / 2 + curb(b), curbLift, curbLift, curbColor(-1), curbMat, multiples(curbLen));
  if (colors.racingLine != null) {
    const line = new THREE.Color(colors.racingLine);
    const dash = colors.centreDash;
    const dashColor = dash ? line.clone().lerp(new THREE.Color(dash.color), dash.opacity) : line;
    const lineMat = colors.animasAsphalt ? animasAsphaltLineMaterial() : sharedVertexToonDouble();
    roadStrip(
      () => -0.125,
      () => 0.125,
      0.045,
      0.045,
      dash ? (d) => (((d % dash.period) + dash.period) % dash.period < dash.length ? dashColor : line) : flat(line),
      lineMat,
      dash ? [...multiples(dash.period), ...multiples(dash.period, dash.length)] : [],
    );
  }
  if (colors.bankEdge) bankEdge(group, track, left, heightAt, nodeKappa, curb(0));
  // Arcén.
  // Bajo una plataforma elevada (`track.lifts`) no hay arcén: fuera de la calzada es el vacío.
  if (v > 0) {
    const vergeColor = flat(new THREE.Color(colors.verge));
    const spans = track.lifts.map((l) => [l.from - l.easeIn, l.to + l.easeOut] as const);
    const edges = spans.flat();
    const hole = spans.length ? (d: number) => spans.some(([a, b]) => d >= a && d <= b) : undefined;
    roadStrip((w) => w / 2, (w) => w / 2 + v, 0, 0, vergeColor, sharedVertexToonDouble(), edges, false, hole);
    roadStrip((w) => -w / 2 - v, (w) => -w / 2, 0, 0, vergeColor, sharedVertexToonDouble(), edges, false, hole);
  }
  // Muros bajos en el borde exterior del arcén, con tapa de hueso. En Ánimas los sustituyen las vallas de calaveras.
  if (!colors.animasAsphalt) {
    strip((w) => w / 2 + v, (w) => w / 2 + v, colors.wall, colors.wall, 0.9, 0);
    strip((w) => -w / 2 - v, (w) => -w / 2 - v, colors.wall, colors.wall, 0.9, 0);
    strip((w) => w / 2 + v - 0.16, (w) => w / 2 + v + 0.16, PALETTE.hueso, PALETTE.hueso, 0.96, 0.96);
    strip((w) => -w / 2 - v - 0.16, (w) => -w / 2 - v + 0.16, PALETTE.hueso, PALETTE.hueso, 0.96, 0.96);
  }
  // Talud desde el borde (ya peraltado) hasta el suelo.
  // En Ánimas lo sustituye el terreno, que abraza el borde.
  if (!colors.animasAsphalt) {
    strip((w) => w / 2 + v, (w) => w / 2 + v + 6, colors.verge, colors.verge, 0, 0, false, true);
    strip((w) => -w / 2 - v - 6, (w) => -w / 2 - v, colors.verge, colors.verge, 0, 0, true, false);
  }

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
