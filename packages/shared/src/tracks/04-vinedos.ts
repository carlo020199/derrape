// Circuito 4 — Viñedos (Copa Sol, ★★). Diseño original.
// Colinas y bodegas: subidas, bajadas y saltos en las crestas.

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "vinedos",
  name: "Viñedos",
  theme: "vinedos",
  laps: 3,
  width: 14,
  verge: 5,
  control: ovalTrack(168, 218, S, 16, (t) => ({
    y: Math.sin(t * Math.PI * 2) * 5 + 3,
  })),
  itemRows: [0.18, 0.48, 0.75],
  zones: [
    { type: "ramp", from: 0.3, to: 0.36 },
    { type: "ramp", from: 0.58, to: 0.64 },
  ],
  landmarks: [{ kind: "bodega", x: 50 * S, z: 80 * S }],
  seed: 4418,
};

export default def;
