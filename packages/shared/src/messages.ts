// Mensajes cliente/servidor. Cada cliente simula su kart y manda su estado; el servidor manda en
// la sala, la cuenta atrás, las vueltas, las posiciones y los resultados (ver CLAUDE.md).

export const ROOM_RACE = "race";
export const SERVER_PORT = 2567;

/** Colores de kart elegibles (uno por jugador en la sala). */
export const KART_COLORS = [0xff6b35, 0x2e86de, 0x2ecc71, 0x9b5de5, 0xffd23f, 0xe63946, 0x00b4d8, 0xf472b6] as const;
export const COLOR_NAMES = ["Naranja", "Azul", "Verde", "Morado", "Amarillo", "Rojo", "Turquesa", "Rosa"] as const;

/** Letras del código de sala (sin I, O ni similares, para que se lean bien). */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;

export function randomRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)];
  return code;
}

/** Normaliza lo que escribe el jugador ("abc d" → "ABCD"); null si no es un código válido. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z]/g, "");
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_LETTERS.includes(c)) ? code : null;
}

export const MAX_NAME_LENGTH = 12;
export function normalizeName(input: unknown): string {
  const name = typeof input === "string" ? input.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH) : "";
  return name || "Piloto";
}

/** Opciones al crear o unirse a una sala. */
export interface JoinOptions {
  name: string;
  /** Índice en KART_COLORS que se prefiere (si está libre). */
  color?: number;
}

export type RoomPhase = "lobby" | "countdown" | "racing";

export interface LobbyPlayer {
  id: string;
  name: string;
  /** Índice en KART_COLORS. */
  color: number;
  host: boolean;
  connected: boolean;
  /** Está corriendo la carrera actual (los que entran a mitad esperan a la siguiente). */
  racing: boolean;
}

export interface LobbyMessage {
  code: string;
  phase: RoomPhase;
  trackId: string;
  players: LobbyPlayer[];
}

/** Estado del kart que manda cada cliente ~20 veces/s (lo justo para dibujarlo en los demás). */
export interface NetKartState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  driftDir: number;
  driftLevel: number;
  hop: number;
  boosting: boolean;
  spinning: boolean;
  shield: boolean;
  /** Cuántas veces ha reaparecido (un salto de posición legítimo). */
  respawns: number;
}

export interface CountdownMessage {
  trackId: string;
  laps: number;
  /** Segundos de cuenta atrás. */
  seconds: number;
  /** Ids de los jugadores en orden de parrilla. */
  grid: string[];
  /** Al volver a una carrera ya empezada: segundos desde que empezó la cuenta atrás. */
  elapsed?: number;
  /** Al volver a una carrera ya empezada: dónde estaba tu kart. */
  resume?: NetKartState;
}

export interface KartSnapshot {
  id: string;
  s: NetKartState;
  lap: number;
  position: number;
  finished: boolean;
}

export interface StatesMessage {
  /** Reloj del servidor (ms). */
  t: number;
  karts: KartSnapshot[];
}

export interface RaceResult {
  id: string;
  name: string;
  color: number;
  position: number;
  /** Tiempo total (s) o null si no terminó. */
  time: number | null;
}

export interface ResultsMessage {
  results: RaceResult[];
}

/** Tipos de mensaje. Cliente → servidor: profile, setTrack, start, state. Servidor → cliente: el resto. */
export const MSG = {
  profile: "profile",
  setTrack: "setTrack",
  start: "start",
  state: "state",
  lobby: "lobby",
  countdown: "countdown",
  states: "states",
  results: "results",
  error: "error",
} as const;

export interface ProfileMessage {
  name?: string;
  color?: number;
}
