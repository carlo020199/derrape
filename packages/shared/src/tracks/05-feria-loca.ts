// Circuito 5 — Feria Loca (Copa Sol, ★★). Diseño original.
// Parque de atracciones: curva amplia y paneles de turbo.

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "feria-loca",
  name: "Feria Loca",
  theme: "feria",
  laps: 3,
  width: 15,
  verge: 4,
  control: ovalTrack(162, 212, S, 16, (t) => ({
    w: t > 0.2 && t < 0.4 ? 18 : 15,
    y: t > 0.2 && t < 0.4 ? 2 : 0,
  })),
  itemRows: [0.2, 0.52, 0.82],
  zones: [
    { type: "boostPad", from: 0.28, to: 0.34 },
    { type: "boostPad", from: 0.62, to: 0.68 },
    { type: "boostPad", from: 0.88, to: 0.93 },
  ],
  landmarks: [
    { kind: "noria", x: 90 * S, z: 40 * S },
    { kind: "tienda", x: -40 * S, z: -20 * S },
  ],
  seed: 5525,
};

export default def;
