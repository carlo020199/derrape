// Circuito 12 — Ribera de las Ánimas (extra, fuera de copa, ★★). Diseño original.
//
// Una vuelta sencilla en sentido antihorario alrededor de la laguna espectral, más llana y abierta
// que la Laguna de las Ánimas. Se sale hacia el norte por la Recta de Meta (rampa S), curva peraltada
// del Campanario, Recta del Osario en alto (rampa M), la Herradura —la curva más peraltada— bajando
// hacia el oeste, la ese del Embarcadero pegada al agua, y vuelta por el sur con la rampa L antes de
// la curva del Farol que devuelve a meta.

import type { TrackDef } from "./types";

/** El trazado se diseñó a escala 1 y se agranda para que la vuelta ronde los 1.450 m. */
const S = 1.12;
/** x, z, altura y peralte en grados (+ = curva a la izquierda, con el borde derecho más alto). */
// En el juego la izquierda es +X: el plano se dibujó con X hacia la derecha, así que se invierte.
const p = (x: number, z: number, y = 0, bank = 0) => ({ x: -x * S, z: z * S, y, bank });

const def: TrackDef = {
  id: "ribera-de-las-animas",
  name: "Ribera de las Ánimas",
  theme: "animas",
  laps: 3,
  width: 16,
  verge: 6,
  control: [
    p(150, -140), // meta
    p(150, -40),
    p(148, 60, 1),
    p(120, 140, 2.5, 17), // curva del Campanario
    p(50, 185, 4, 11),
    p(-40, 185, 4.5), // Recta del Osario, en alto
    p(-120, 160, 5, 16),
    p(-175, 95, 4.5, 21), // la Herradura
    p(-180, 10, 2.5, 6),
    p(-150, -60, 1, 11), // baja al Embarcadero
    p(-85, -85, 0.3),
    p(-40, -130, 0, -11), // ese junto al agua (a la derecha)
    p(-45, -200, 0, 6),
    p(-10, -250, 0.5, 14),
    p(70, -260, 1.5), // recta sur
    p(135, -225, 0.8, 16), // curva del Farol
  ],
  itemRows: [0.2, 0.52, 0.74],
  zones: [
    { type: "ramp", size: "S", from: 0.105, to: 0.1078 },
    { type: "ramp", size: "M", from: 0.315, to: 0.3205 },
    { type: "ramp", size: "L", from: 0.84, to: 0.848 },
  ],
  landmarks: [{ kind: "laguna", x: 0, z: 0 }],
  seed: 3111,
};

export default def;
