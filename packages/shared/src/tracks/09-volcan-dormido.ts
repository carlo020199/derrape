// Circuito 9 — Volcán Dormido (Copa Luna, ★★★). Diseño original.
// Selva y lava: atajo arriesgado junto a la lava (caer = respawn).

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "volcan-dormido",
  name: "Volcán Dormido",
  theme: "volcan",
  laps: 3,
  width: 14,
  verge: 4,
  control: ovalTrack(170, 220, S),
  itemRows: [0.18, 0.5, 0.78],
  zones: [
    { type: "fall", from: 0.4, to: 0.55, lateralMin: 6, lateralMax: 25 },
    { type: "slow", from: 0.65, to: 0.75, lateralMin: 6, lateralMax: 20 },
  ],
  landmarks: [{ kind: "volcan", x: 80 * S, z: 40 * S }],
  seed: 9966,
};

export default def;
