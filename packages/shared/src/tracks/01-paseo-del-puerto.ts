// Circuito 1 — Paseo del Puerto (Copa Sol, ★). Diseño original.
//
// Ciudad mediterránea junto al mar. Se sale por el paseo marítimo hacia el norte, con la dársena
// (el puerto interior, con barcos) a la izquierda. Curva amplia hasta el espigón, recta hacia el faro,
// gran U alrededor del faro, vuelta por el muelle interior, unas eses suaves y subida por el casco
// antiguo antes de bajar a meta. Curvas amplias: es el circuito para aprender a derrapar.

import type { TrackDef } from "./types";

/** El trazado se diseñó a escala 1 y se agranda para que la vuelta dure 60–75 s. */
const S = 1.25;
const p = (x: number, z: number, y = 0) => ({ x: x * S, z: z * S, y });

const def: TrackDef = {
  id: "paseo-del-puerto",
  name: "Paseo del Puerto",
  theme: "puerto",
  laps: 3,
  width: 16,
  verge: 6,
  control: [
    p(0, -200), // meta, en el paseo marítimo
    p(0, -60),
    p(5, 40),
    p(30, 120), // curva amplia a la derecha hacia la bocana
    p(90, 170),
    p(170, 180), // espigón hacia el faro
    p(240, 150),
    p(255, 90), // U alrededor del faro
    p(220, 50),
    p(150, 40), // muelle interior
    p(110, 0),
    p(100, -70), // eses suaves
    p(130, -140, 1.5),
    p(110, -210, 3.5), // subida al casco antiguo
    p(60, -250, 4.5),
    p(15, -245, 3),
  ],
  itemRows: [0.18, 0.47, 0.76],
  landmarks: [
    { kind: "faro", x: 278 * S, z: 125 * S },
    { kind: "darsena", x: 0, z: 0 },
  ],
  seed: 1909,
};

export default def;
