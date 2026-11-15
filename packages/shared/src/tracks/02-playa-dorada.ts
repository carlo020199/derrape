// Circuito 2 — Playa Dorada (Copa Sol, ★). Diseño original.
// Paseo marítimo y dunas: arena fuera de pista muy lenta; rampas en las dunas.

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "playa-dorada",
  name: "Playa Dorada",
  theme: "playa",
  laps: 3,
  width: 15,
  verge: 8,
  control: ovalTrack(170, 220, S, 16, (t) => ({
    y: t > 0.55 && t < 0.75 ? 3 + Math.sin(((t - 0.55) / 0.2) * Math.PI) * 3 : 0,
  })),
  itemRows: [0.2, 0.5, 0.78],
  zones: [
    { type: "slow", from: 0.15, to: 0.45, lateralMin: 7, lateralMax: 30 },
    { type: "slow", from: 0.15, to: 0.45, lateralMin: -30, lateralMax: -7 },
    { type: "ramp", from: 0.58, to: 0.64 },
    { type: "ramp", from: 0.68, to: 0.74 },
  ],
  landmarks: [
    { kind: "sombrilla", x: 120 * S, z: 40 * S },
    { kind: "sombrilla", x: -80 * S, z: -60 * S },
  ],
  seed: 2204,
};

export default def;
