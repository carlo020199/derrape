// Índice de circuitos. Cada uno se carga bajo demanda (import dinámico): en el móvil solo se
// descarga el que se va a jugar.

import type { TrackDef } from "./types";

export interface TrackEntry {
  id: string;
  /** Número en la 1.0 (1–10) o 0 para los de pruebas. */
  number: number;
  name: string;
  cup: "sol" | "luna" | null;
  load: () => Promise<TrackDef>;
}

export const TRACKS: TrackEntry[] = [
  { id: "pruebas", number: 0, name: "Circuito de pruebas", cup: null, load: () => import("./00-pruebas").then((m) => m.default) },
  {
    id: "paseo-del-puerto",
    number: 1,
    name: "Paseo del Puerto",
    cup: "sol",
    load: () => import("./01-paseo-del-puerto").then((m) => m.default),
  },
  // Circuitos 2–10: Fase 8 (ver docs/CONTENIDO.md).
];

export const DEFAULT_TRACK = "paseo-del-puerto";

export function findTrack(id: string): TrackEntry | undefined {
  return TRACKS.find((t) => t.id === id);
}
