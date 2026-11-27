// Circuito 13 — Desván de las Maravillas (extra, fuera de copa, ★★★). Diseño original.
//
// Muebles viejos en un mundo de fantasía. Un circuito largo (≈1.880 m, vuelta de bot ≈74 s) en sentido
// horario: recta de meta subiendo, curva ancha norte, tres eses, diagonal larga hacia el suroeste, horquilla
// interior, segunda diagonal hacia el este, curva grande al sureste, recta inferior y curva con abanico hacia meta.
// Fase 1: trazado y turbos de suelo (azul ×1,5 y naranja ×1,75). Rampas, raíl triturbo, plataforma y arte de
// muebles llegan en fases posteriores (ver docs/circuito-nuevo/). El tema es `animas` de momento.
// Plan y vista previa: /workspace/derrape-plan-circuito (PLAN.md §1.2 y §2.3).

import { smoothTrack } from "../track";
import type { TrackDef, ZoneDef } from "./types";

/** Escala del plano del boceto (0,8 da vuelta de ≈74 s; con menos las eses no caben). */
const S = 0.8;
/** x, z, altura y peralte en grados (+ = curva a la izquierda). Mi circuito es horario: curvas a derechas, peralte negativo. */
// En el juego la izquierda es +X: el plano se dibujó con X hacia la derecha, así que se invierte.
const p = (x: number, z: number, y = 0, bank = 0) => ({ x: -x * S, z: z * S, y, bank });

const control = [
  p(-150, -40), // 0 meta
  p(-150, 70),
  p(-150, 165, 0.5, -4),
  p(-120, 245, 1.5, -12), // esquina arriba a la izquierda
  p(-50, 288, 2.5, -14),
  p(40, 296, 3, -12), // curva ancha
  p(125, 268, 3, -12),
  p(185, 215, 2.5, -8),
  p(208, 150, 2, -12), // ese 1 (derecha)
  p(166, 82, 1.5, 12), // ese 2 (izquierda)
  p(204, 14, 1, -8), // ese 3 (derecha)
  p(175, -30, 0.5),
  p(115, -62), // diagonal larga
  p(30, -100),
  p(-45, -135),
  p(-96, -160, 0, 14), // horquilla interior
  p(-104, -212, 0, 16),
  p(-62, -248, 0, 12),
  p(10, -232), // segunda diagonal
  p(95, -205),
  p(170, -192, 0, -8),
  p(225, -225, 0, -18), // curva grande
  p(222, -285, 0, -18),
  p(165, -322, 0, -10),
  p(60, -330), // borde inferior
  p(-50, -326),
  p(-135, -304, 0, -8),
  p(-170, -245, 0, -4),
  p(-158, -140),
];

const WIDTH = 16;
const VERGE = 6;
/** Longitud de la vuelta (m): las zonas y las cajas se escriben en metros desde meta y aquí se pasan a fracciones. */
const LENGTH = smoothTrack(control, WIDTH, 3, VERGE).length;
const m = (d: number) => d / LENGTH;

/** Franja ancha: casi todo el asfalto. Las franjas estrechas son de 3 m de ancho (el kart mide 1,8 m). */
const WIDE = { lateralMin: -7.5, lateralMax: 7.5 };
const pad = (type: ZoneDef["type"], from: number, to: number, lateralMin = WIDE.lateralMin, lateralMax = WIDE.lateralMax): ZoneDef => ({
  type,
  from: m(from),
  to: m(to),
  lateralMin,
  lateralMax,
});

// Metros desde meta y franja lateral (+ = izquierda). Ver PLAN.md §2.3. 13 azules y 6 naranjas.
const zones: ZoneDef[] = [
  // A — recta de meta
  pad("boostBlue", 20, 26),
  pad("boostOrangeNarrow", 70, 78, 3, 6),
  // B — curva ancha
  pad("boostBlueNarrow", 330, 338, 1, 4),
  pad("boostOrange", 470, 478),
  // C — eses: línea interior de cada apoyo
  pad("boostBlueNarrow", 538, 544, -5, -2),
  pad("boostBlueNarrow", 600, 606, 2, 5),
  pad("boostBlueNarrow", 664, 670, -5, -2),
  // D — diagonal 1
  pad("boostOrange", 900, 906),
  // E — horquilla
  pad("boostBlueNarrow", 988, 994, 3, 6),
  pad("boostOrange", 1188, 1194),
  // G — curva grande (abanico)
  pad("boostBlueNarrow", 1230, 1238, -6, -3),
  pad("boostBlueNarrow", 1250, 1258, -1, 2),
  pad("boostBlueNarrow", 1270, 1278, 3, 6),
  pad("boostOrangeNarrow", 1400, 1408, -1.5, 1.5),
  // I — curva inferior izquierda (abanico hacia meta)
  pad("boostBlueNarrow", 1625, 1633, -6, -3),
  pad("boostBlueNarrow", 1642, 1650, 3, 6),
  pad("boostBlueNarrow", 1670, 1678, -3, 0),
  pad("boostBlueNarrow", 1700, 1708, 0, 3),
  pad("boostOrangeNarrow", 1735, 1745, -1.5, 1.5),
];

/** Rampa-mueble: con tamaño (vuelo balístico) y turbo al aterrizar (`landBoost`). Largo S = 4 m, M = 8 m. */
const ramp = (size: "S" | "M", from: number): ZoneDef => ({
  type: "ramp",
  size,
  from: m(from),
  to: m(from + (size === "S" ? 4 : 8)),
  landBoost: true,
});

// Rampas-mueble (PLAN §2.4). Los huecos labio→siguiente rampa salen de `scripts/cadenas.ts` (física real).
const ramps: ZoneDef[] = [
  // A — cadena de 3 S
  ramp("S", 116),
  ramp("S", 146),
  ramp("S", 192),
  // C — S sola a la salida de las eses
  ramp("S", 715),
  // F — cadena de 2 M
  ramp("M", 1090),
  ramp("M", 1130),
];

const def: TrackDef = {
  id: "desvan-de-las-maravillas",
  name: "Desván de las Maravillas",
  theme: "animas",
  laps: 3,
  width: WIDTH,
  verge: VERGE,
  control,
  // Cajas de objetos (m desde meta): 45, 290, 940, 1.300, 1.510 y 1.700. Nunca sobre un turbo.
  itemRows: [45, 290, 940, 1300, 1510, 1700].map(m),
  zones: [...zones, ...ramps],
  seed: 4813,
};

export default def;
