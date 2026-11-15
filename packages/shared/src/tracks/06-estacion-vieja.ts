// Circuito 6 — Estación Vieja (Copa Luna, ★★). Diseño original.
// Estación y vías: pasos a nivel con trenes que cruzan cada X segundos.

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "estacion-vieja",
  name: "Estación Vieja",
  theme: "estacion",
  laps: 3,
  width: 14,
  verge: 4,
  control: ovalTrack(170, 222, S),
  itemRows: [0.2, 0.5, 0.78],
  hazards: [
    { type: "gate", from: 0.3, to: 0.36, period: 8, active: 2, phase: 0 },
    { type: "gate", from: 0.7, to: 0.76, period: 9, active: 2.2, phase: 3 },
  ],
  landmarks: [{ kind: "estacion", x: 60 * S, z: 50 * S }],
  seed: 6630,
};

export default def;
