// Circuito 8 — Cañón Rojo (Copa Luna, ★★★). Diseño original.
// Desierto: puentes estrechos y salto largo sobre el cañón.

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "canon-rojo",
  name: "Cañón Rojo",
  theme: "canon",
  laps: 3,
  width: 14,
  verge: 3,
  control: ovalTrack(172, 225, S, 18, (t) => ({
    w: t > 0.3 && t < 0.42 ? 8 : 14,
  })),
  itemRows: [0.2, 0.48, 0.8],
  zones: [
    { type: "ramp", from: 0.72, to: 0.78 },
    { type: "fall", from: 0.74, to: 0.8, lateralMin: 8, lateralMax: 40 },
    { type: "fall", from: 0.74, to: 0.8, lateralMin: -40, lateralMax: -8 },
  ],
  landmarks: [{ kind: "arco", x: 100 * S, z: 20 * S }],
  seed: 8855,
};

export default def;
