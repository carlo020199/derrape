// Circuito 7 — Pico Nevado (Copa Luna, ★★★). Diseño original.
// Montaña nevada: tramos de hielo con menos agarre.

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "pico-nevado",
  name: "Pico Nevado",
  theme: "nieve",
  laps: 3,
  width: 13,
  verge: 5,
  control: ovalTrack(168, 218, S, 16, (t) => ({
    y: (1 - Math.cos(t * Math.PI * 2)) * 8,
  })),
  itemRows: [0.18, 0.45, 0.72],
  zones: [
    { type: "lowGrip", from: 0.35, to: 0.5 },
    { type: "lowGrip", from: 0.6, to: 0.78 },
    { type: "ramp", from: 0.22, to: 0.28 },
  ],
  landmarks: [{ kind: "cabanas", x: 40 * S, z: 60 * S }],
  seed: 7742,
};

export default def;
