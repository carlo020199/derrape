// Circuito 11 — Laguna de las Ánimas (extra, fuera de copa, ★★★). Diseño original.
// PROPUESTA de Dalí (no está en el repo). Inspirado en la forma de un trazado clásico de F1 antihorario
// (ese de bajada tras meta, recta opuesta, curva amplia de la laguna, enlazadas del infield, horquilla,
// zambullida, cruce y subida larga hasta meta). Sin nombres ni logos oficiales.
//
// Requiere los campos nuevos que se describen en PROPUESTA.md §Circuito nuevo:
//  - TrackPoint.bank (grados; + = la curva gira a la izquierda del piloto y se levanta el borde derecho)
//  - ZoneDef.size ("S" | "M" | "L") para las rampas
//  - ThemeId "animas"
// Coordenadas en el sistema del juego: x, z en metros (z = -norte, visto desde arriba gira antihorario),
// y = altura (m). Longitud ≈ 1491 m → 67.5 s al ritmo del test (punta × 0,85).
// Desnivel 41 m (de -6,3 a 35 m), pendiente máx. ≈ 21 % (Catmull-Rom; 17 % entre puntos de control).

import type { TrackDef } from "./types";

/** (x, z, altura, ancho, peralte en grados) */
const p = (x: number, z: number, y: number, w: number, bank: number) => ({ x, z, y, w, bank });

const def: TrackDef = {
  id: "laguna-de-las-animas",
  name: "Laguna de las Ánimas",
  theme: "animas",
  laps: 3,
  width: 14,
  verge: 3,
  control: [
    p(-75, 95, 34, 16, 0), //  0 · Recta de meta
    p(-62, 150, 31.4, 16, 0), //  1 · Recta de meta
    p(-52, 185, 25.2, 18, 30), //  2 · Ese del Sepulturero
    p(-35, 200, 21.4, 18, 20), //  3 · Ese del Sepulturero
    p(-12, 190, 18, 18, -8), //  4 · Ese del Sepulturero (el -15° de diseño caía en el aterrizaje de S1)
    p(12, 196, 16, 16, 0), //  5 · Ese del Sepulturero
    p(40, 202, 14, 16, 35), //  6 · Curva del Sol Negro
    p(68, 190, 12, 16, 35), //  7 · Curva del Sol Negro
    p(85, 160, 10, 16, 5), //  8 · Curva del Sol Negro
    p(97, 120, 8, 16, 0), //  9 · Recta del Osario
    p(110, 60, 2, 16, 0), // 10 · Recta del Osario
    p(125, 0, -1, 16, 0), // 11 · Recta del Osario
    p(135, -40, -3, 16, 30), // 12 · Bajada de la Laguna
    p(128, -68, -4, 16, 40), // 13 · Bajada de la Laguna
    p(100, -78, -3, 16, 35), // 14 · Bajada de la Laguna
    p(68, -72, 1, 15, 35), // 15 · La Herradura
    p(45, -52, 6, 15, 10), // 16 · La Herradura
    p(20, -15, 11, 15, 0), // 17 · Cuesta de los Faroles
    p(-5, 20, 14, 15, -5), // 18 · Cuesta de los Faroles
    p(-25, 42, 15, 16, -30), // 19 · La Calabaza
    p(-45, 47, 15, 16, -40), // 20 · La Calabaza
    p(-56, 35, 14, 16, -30), // 21 · La Calabaza
    p(-60, 5, 13, 15, -20), // 22 · La Calabaza
    p(-57, -18, 12, 15, -40), // 23 · Codo del Campanero
    p(-46, -33, 11, 15, -15), // 24 · Codo del Campanero
    p(-32, -40, 10, 15, 15), // 25 · Pinar de Huesos
    p(-28, -53, 9, 15, 40), // 26 · Pinar de Huesos
    p(-40, -68, 8, 15, 20), // 27 · Pinar de Huesos
    p(-58, -82, 7, 15, -5), // 28 · Pico de Cuervo (entrada suave: S2 aterriza aquí)
    p(-64, -100, 7, 16, -40), // 29 · Pico de Cuervo
    p(-50, -113, 6.6, 16, -40), // 30 · Pico de Cuervo
    p(-30, -106, 3, 15, -30), // 31 · Pico de Cuervo
    p(-12, -90, -1.1, 15, 0), // 32 · El Zambullido
    p(0, -77, -4.1, 15, 8), // 33 · El Zambullido (S3 aterriza antes del peralte de 40°)
    p(20, -78, -6.3, 15, 40), // 34 · Cruce de Almas
    p(35, -90, -3.1, 16, 30), // 35 · Cruce de Almas
    p(48, -110, 1, 16, 15), // 36 · Subida de las Linternas
    p(58, -135, 5.6, 16, 35), // 37 · Subida de las Linternas
    p(55, -158, 9.5, 16, 40), // 38 · Subida de las Linternas
    p(35, -170, 13.5, 16, 35), // 39 · Subida de las Linternas
    p(5, -170, 18.6, 16, 10), // 40 · Subida de las Linternas
    p(-30, -162, 24.7, 16, 25), // 41 · Subida de las Linternas
    p(-60, -140, 28, 16, 0), // 42 · Subida de las Linternas
    p(-92, -112, 31, 16, 30), // 43 · Subida de las Linternas
    p(-102, -75, 33, 16, 5), // 44 · Recta de meta
    p(-104, -30, 34, 16, 0), // 45 · Recta de meta
    p(-96, 20, 35, 16, 0), // 46 · Recta de meta
    p(-86, 60, 35, 16, 0), // 47 · Recta de meta
  ],
  itemRows: [0.16, 0.36, 0.52, 0.74, 0.93],
  zones: [
    { type: "ramp", size: "S", from: 0.0843, to: 0.087 }, // S1 · Ese del Sepulturero · labio 0.6 m · ~76 km/h · 0.88 s en el aire · 18 m
    { type: "ramp", size: "L", from: 0.189, to: 0.197 }, // L1 · Recta del Osario · labio 3.0 m · ~94 km/h · 1.52 s en el aire · 38 m
    { type: "ramp", size: "M", from: 0.4156, to: 0.421 }, // M1 · Cuesta de los Faroles · labio 1.5 m · ~92 km/h · 0.91 s en el aire · 23 m
    { type: "ramp", size: "S", from: 0.5853, to: 0.588 }, // S2 · Pinar de Huesos · labio 0.6 m · ~91 km/h · 0.77 s en el aire · 19 m
    { type: "ramp", size: "S", from: 0.6513, to: 0.654 }, // S3 · El Zambullido · labio 0.6 m · ~94 km/h · 1.2 s en el aire · 31 m
    { type: "ramp", size: "M", from: 0.8816, to: 0.887 }, // M2 · Recta de meta · labio 1.5 m · ~93 km/h · 0.91 s en el aire · 23 m
    { type: "boostPad", from: 0.505, to: 0.52 }, // salida de La Calabaza, por dentro del peralte
    { type: "boostPad", from: 0.62, to: 0.632 }, // salida del Pico de Cuervo
    { type: "fall", from: 0.19, to: 0.235, lateralMin: 8.5, lateralMax: 40 }, // laguna espectral bajo el salto L1 (izquierda)
    { type: "fall", from: 0.19, to: 0.235, lateralMin: -40, lateralMax: -8.5 }, // y derecha
  ],
  landmarks: [
    { kind: "campanario", x: -150, z: 40 },
    { kind: "laguna", x: 60, z: 30 },
    { kind: "calabaza", x: -35, z: 10 },
    { kind: "arco-calavera", x: -75, z: 95 }, // sustituye al arco de salida genérico,
  ],
  seed: 1111,
};

export default def;
