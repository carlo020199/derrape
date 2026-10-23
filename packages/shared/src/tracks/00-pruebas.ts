// Circuito de pruebas (no es uno de los 10 de la 1.0): recta de salida, curva larga,
// chicane en S, curva rápida y una U amplia para probar los controles y los objetos.

import type { TrackDef } from "./types";

const def: TrackDef = {
  id: "pruebas",
  name: "Circuito de pruebas",
  theme: "pruebas",
  laps: 3,
  width: 14,
  verge: 0,
  control: [
    { x: 0, z: -50 },
    { x: 0, z: 30 },
    { x: 8, z: 70 },
    { x: 35, z: 95 },
    { x: 75, z: 95 },
    { x: 100, z: 75 },
    { x: 100, z: 50 },
    { x: 80, z: 38 },
    { x: 74, z: 18 },
    { x: 92, z: 2 },
    { x: 122, z: -12 },
    { x: 130, z: -45 },
    { x: 112, z: -88 },
    { x: 80, z: -118 },
    { x: 45, z: -115 },
    { x: 20, z: -105 },
    { x: 5, z: -85 },
  ],
  itemRows: [0.12, 0.38, 0.62, 0.86],
  seed: 1,
};

export default def;
