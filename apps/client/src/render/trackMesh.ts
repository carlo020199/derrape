import * as THREE from "three";
import { RAMPS, pointAt, type RampSize, type Track } from "@derrape/shared";
import { PAL, toon } from "./look";

// Malla de la pista generada a partir de la línea central: asfalto, bordillos, arcén,
// muros y talud hasta el suelo (para los tramos elevados). Las tiras siguen el peralte de cada punto
// y las rampas se dibujan como cuñas con flechas.

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
    /** Borde que NO sigue el peralte (el pie del talud, que va al suelo). */
    flat: "in" | "out" | null = null,
  ) {
    const pos: number[] = [];
    const col: number[] = [];
    const ca = new THREE.Color(colorA);
    const cb = new THREE.Color(colorB);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const vert = (k: number, off: number, y: number) => [pts[k]!.x + left[k]!.x * off, y, pts[k]!.z + left[k]!.z * off];
      const tilt = (k: number, off: number, edge: "in" | "out") => (flat === edge ? 0 : off * Math.tan(pts[k]!.bank));
      const corner = (k: number, edge: "in" | "out") => {
        const off = (edge === "in" ? inner : outer)(pts[k]!.w);
        return vert(k, off, (edge === "in" ? yIn : yOut)(pts[k]!.y) + tilt(k, off, edge));
      };
      const a0 = corner(i, "in");
      const a1 = corner(i, "out");
      const b0 = corner(j, "in");
      const b1 = corner(j, "out");
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
  strip((w) => w / 2 + v, (w) => w / 2 + v + 6, colors.verge, colors.verge, (y) => y, ground, 1, "out");
  strip((w) => -w / 2 - v - 6, (w) => -w / 2 - v, colors.verge, colors.verge, ground, (y) => y, 1, "in");

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

  addRamps(group, track);
  return group;
}

const RAMP_COLORS: Record<RampSize, number> = { S: PAL.espectro, M: PAL.brasa, L: PAL.anima };

/** Flechas hacia delante sobre fondo oscuro, del color del tamaño de la rampa. */
function chevronTexture(color: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1e1830";
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  g.lineWidth = 9;
  g.lineJoin = "miter";
  for (const y of [30, 58]) {
    g.beginPath();
    g.moveTo(8, y);
    g.lineTo(32, y - 22);
    g.lineTo(56, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Una cuña por rampa: empieza a ras de asfalto y sube hasta `rise` en `length` metros. */
function addRamps(group: THREE.Group, track: Track) {
  const side = toon(PAL.ciruela);
  side.side = THREE.DoubleSide;
  for (const ramp of track.ramps) {
    const { length, rise } = RAMPS.sizes[ramp.size];
    const at = (d: number, lateral: number, lift: number) => {
      const p = pointAt(track, d, lateral);
      return [p.x, p.y + lateral * Math.tan(p.bank) + lift, p.z];
    };
    const d0 = ramp.distance;
    const d1 = ramp.distance + length;
    const [l, r] = [ramp.lateralMax, ramp.lateralMin];
    const a = at(d0, l, 0.05);
    const b = at(d0, r, 0.05);
    const c = at(d1, r, rise);
    const d = at(d1, l, rise);
    const cFoot = at(d1, r, 0.02);
    const dFoot = at(d1, l, 0.02);

    const top = new THREE.BufferGeometry();
    top.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    const repeat = Math.max(1, Math.round((l - r) / 4));
    top.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, repeat, 0, repeat, 1, 0, 0, repeat, 1, 0, 1], 2));
    const tex = chevronTexture(RAMP_COLORS[ramp.size]);
    group.add(new THREE.Mesh(top, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));

    // Cara de atrás y los dos costados.
    const body = new THREE.BufferGeometry();
    body.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([...d, ...c, ...cFoot, ...d, ...cFoot, ...dFoot, ...a, ...d, ...dFoot, ...b, ...cFoot, ...c], 3),
    );
    body.computeVertexNormals();
    group.add(new THREE.Mesh(body, side));

    // Borde luminoso en el labio de la rampa.
    const lip = new THREE.BufferGeometry();
    lip.setAttribute("position", new THREE.Float32BufferAttribute([...c, ...d], 3));
    group.add(new THREE.Line(lip, new THREE.LineBasicMaterial({ color: RAMP_COLORS[ramp.size] })));
  }
}
