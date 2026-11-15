// Formato de un circuito como DATOS. Añadir un circuito = un archivo nuevo con un TrackDef.

import { smoothTrack, type Track, type TrackHazard, type TrackPoint, type TrackZone, type ZoneType } from "../track";
import type { RampSize } from "../tuning";

/** Kits de tema disponibles (decoración, colores). El cliente sabe dibujar cada uno. */
export type ThemeId =
  | "pruebas"
  | "puerto"
  | "playa"
  | "mercado"
  | "vinedos"
  | "feria"
  | "estacion"
  | "nieve"
  | "canon"
  | "volcan"
  | "neon"
  | "animas";

export interface ZoneDef {
  type: ZoneType;
  /** Tramo de la vuelta en fracciones (0..1). */
  from: number;
  to: number;
  /** Franja lateral en metros (por defecto todo el ancho, arcén incluido). */
  lateralMin?: number;
  lateralMax?: number;
  /** Rampa S/M/L con vuelo real. Sin tamaño, el salto es el de siempre. */
  size?: RampSize;
}

/** Obstáculo periódico (paso a nivel, etc.), en fracciones de vuelta. */
export interface HazardDef {
  type: "gate";
  from: number;
  to: number;
  lateralMin?: number;
  lateralMax?: number;
  /** Periodo completo (s). */
  period: number;
  /** Segundos activo dentro del periodo. */
  active: number;
  /** Desfase inicial (s). */
  phase?: number;
}

/** Elementos únicos del circuito (faro, puerto…). El kit de tema sabe dibujarlos. */
export interface Landmark {
  kind: string;
  x: number;
  z: number;
  rotation?: number;
  scale?: number;
}

export interface TrackDef {
  id: string;
  name: string;
  theme: ThemeId;
  laps: number;
  width: number;
  verge: number;
  control: TrackPoint[];
  itemRows: number[];
  zones?: ZoneDef[];
  hazards?: HazardDef[];
  landmarks?: Landmark[];
  seed: number;
}

export function buildTrackFromDef(def: TrackDef): Track {
  const track = smoothTrack(def.control, def.width, 3, def.verge);
  track.relief = def.control.some((p) => p.bank !== undefined) || (def.zones ?? []).some((z) => z.size !== undefined);
  const outer = def.width / 2 + def.verge + 5;
  track.zones = (def.zones ?? []).map(
    (z): TrackZone => ({
      type: z.type,
      from: z.from * track.length,
      to: z.to * track.length,
      lateralMin: z.lateralMin ?? -outer,
      lateralMax: z.lateralMax ?? outer,
      size: z.size,
    }),
  );
  track.hazards = (def.hazards ?? []).map(
    (h): TrackHazard => ({
      type: h.type,
      from: h.from * track.length,
      to: h.to * track.length,
      lateralMin: h.lateralMin ?? -outer,
      lateralMax: h.lateralMax ?? outer,
      period: h.period,
      active: h.active,
      phase: h.phase ?? 0,
    }),
  );
  return track;
}
