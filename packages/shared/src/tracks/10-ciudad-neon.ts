// Circuito 10 — Ciudad Neón (Copa Luna, ★★★). Diseño original.
// Ciudad de noche: túneles, rampas entre azoteas y luces de neón.

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "ciudad-neon",
  name: "Ciudad Neón",
  theme: "neon",
  laps: 3,
  width: 14,
  verge: 3,
  control: ovalTrack(168, 220, S, 16, (t) => ({
    y: Math.abs(Math.sin(t * Math.PI * 2)) * 6,
  })),
  itemRows: [0.2, 0.48, 0.76],
  zones: [
    { type: "ramp", from: 0.25, to: 0.32 },
    { type: "ramp", from: 0.7, to: 0.76 },
    { type: "boostPad", from: 0.5, to: 0.56 },
  ],
  landmarks: [
    { kind: "rascacielos", x: 50 * S, z: 30 * S },
    { kind: "rascacielos", x: -90 * S, z: -40 * S },
  ],
  seed: 1010,
};

export default def;
