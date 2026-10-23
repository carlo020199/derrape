// Circuito de pruebas (no es uno de los 10 de la 1.0): recta de salida, curva larga,
// chicane en S, curva rápida y una U amplia para probar los controles y los objetos.

import { smoothTrack, type TrackPoint } from "../track";

const CONTROL: TrackPoint[] = [
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
];

export const pruebasTrack = smoothTrack(CONTROL, 14);
