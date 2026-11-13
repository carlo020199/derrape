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
  { id: "playa-dorada", number: 2, name: "Playa Dorada", cup: "sol", load: () => import("./02-playa-dorada").then((m) => m.default) },
  { id: "mercado-central", number: 3, name: "Mercado Central", cup: "sol", load: () => import("./03-mercado-central").then((m) => m.default) },
  { id: "vinedos", number: 4, name: "Viñedos", cup: "sol", load: () => import("./04-vinedos").then((m) => m.default) },
  { id: "feria-loca", number: 5, name: "Feria Loca", cup: "sol", load: () => import("./05-feria-loca").then((m) => m.default) },
  { id: "estacion-vieja", number: 6, name: "Estación Vieja", cup: "luna", load: () => import("./06-estacion-vieja").then((m) => m.default) },
  { id: "pico-nevado", number: 7, name: "Pico Nevado", cup: "luna", load: () => import("./07-pico-nevado").then((m) => m.default) },
  { id: "canon-rojo", number: 8, name: "Cañón Rojo", cup: "luna", load: () => import("./08-canon-rojo").then((m) => m.default) },
  { id: "volcan-dormido", number: 9, name: "Volcán Dormido", cup: "luna", load: () => import("./09-volcan-dormido").then((m) => m.default) },
  { id: "ciudad-neon", number: 10, name: "Ciudad Neón", cup: "luna", load: () => import("./10-ciudad-neon").then((m) => m.default) },
  {
    id: "laguna-de-las-animas",
    number: 11,
    name: "Laguna de las Ánimas",
    cup: null,
    load: () => import("./11-laguna-de-las-animas").then((m) => m.default),
  },
];

export const DEFAULT_TRACK = "paseo-del-puerto";

/** Valores especiales del selector de circuito en el lobby. */
export const TRACK_CHOICE = {
  random: "random",
  cupSol: "cup-sol",
  cupLuna: "cup-luna",
} as const;

export type RaceMode = "single" | "random" | "cup-sol" | "cup-luna";

export function findTrack(id: string): TrackEntry | undefined {
  return TRACKS.find((t) => t.id === id);
}

export function tracksInCup(cup: "sol" | "luna"): TrackEntry[] {
  return TRACKS.filter((t) => t.cup === cup).sort((a, b) => a.number - b.number);
}

export function playableTracks(): TrackEntry[] {
  return TRACKS.filter((t) => t.number > 0);
}

export function pickRandomTrack(random: () => number = Math.random): string {
  // Los extras (sin copa) se eligen a mano. El aleatorio sigue siendo las dos copas.
  const list = TRACKS.filter((t) => t.cup === "sol" || t.cup === "luna");
  return list[Math.floor(random() * list.length)]!.id;
}

export function isTrackChoice(id: string): boolean {
  return id === TRACK_CHOICE.random || id === TRACK_CHOICE.cupSol || id === TRACK_CHOICE.cupLuna || !!findTrack(id);
}
