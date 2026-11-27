// Formato de un circuito como DATOS. Añadir un circuito = un archivo nuevo con un TrackDef.

import { liftAt, smoothTrack, type Track, type TrackHazard, type TrackLift, type TrackPoint, type TrackZone, type ZoneType } from "../track";
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
  | "animas"
  | "desvan";

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
  /** Rampa-mueble: al aterrizar limpio da el turbo de `LANDING`. */
  landBoost?: boolean;
}

/** Tramo elevado (plataforma flotante), en metros desde meta. Ver `TrackLift`. */
export interface LiftDef {
  from: number;
  to: number;
  rise: number;
  easeIn: number;
  easeOut: number;
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

/**
 * Área de asfalto pintado FUERA de la pista (como los logos de patrocinadores de las escapatorias de F1).
 * Es solo decoración: no es zona de juego, `surfaceAt` no la conoce. Polígono convexo en coordenadas del mundo (x, z).
 */
export interface PaintedAreaDef {
  kind: "rosa" | "morada";
  points: { x: number; z: number }[];
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
  /** Plataformas elevadas de la propia pista (metros desde meta). */
  lifts?: LiftDef[];
  /** Asfalto pintado decorativo (sin efecto de juego). */
  paint?: PaintedAreaDef[];
  landmarks?: Landmark[];
  seed: number;
}

export function buildTrackFromDef(def: TrackDef): Track {
  const track = smoothTrack(def.control, def.width, 3, def.verge);
  track.relief = def.control.some((p) => p.bank !== undefined) || (def.zones ?? []).some((z) => z.size !== undefined);
  // Plataformas: se suman a la altura de los nodos; los datos de las zonas (en metros) no cambian.
  track.lifts = (def.lifts ?? []).map((l): TrackLift => ({ ...l }));
  if (track.lifts.length > 0) {
    for (let i = 0; i < track.points.length; i++) track.points[i]!.y += liftAt(track.lifts, track.length, track.lengths[i]!);
  }
  const outer = def.width / 2 + def.verge + 5;
  track.zones = (def.zones ?? []).map(
    (z): TrackZone => ({
      type: z.type,
      from: z.from * track.length,
      to: z.to * track.length,
      lateralMin: z.lateralMin ?? -outer,
      lateralMax: z.lateralMax ?? outer,
      size: z.size,
      landBoost: z.landBoost,
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
