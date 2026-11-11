// Circuito 3 — Mercado Central (Copa Sol, ★★). Diseño original.
// Calles estrechas entre puestos; chicanes; toldos que cortan la visión.

import type { TrackDef } from "./types";
import { ovalTrack } from "./oval";

const S = 1.15;

const def: TrackDef = {
  id: "mercado-central",
  name: "Mercado Central",
  theme: "mercado",
  laps: 3,
  width: 11,
  verge: 3,
  control: ovalTrack(165, 215, S, 18, (t) => ({
    w: t > 0.2 && t < 0.45 ? 8 : t > 0.55 && t < 0.7 ? 9 : 11,
  })),
  itemRows: [0.22, 0.55, 0.8],
  landmarks: [{ kind: "plaza", x: 40 * S, z: 30 * S }],
  seed: 3311,
};

export default def;
