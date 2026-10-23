// Formato de un circuito como DATOS. Añadir un circuito = un archivo nuevo con un TrackDef.

import { smoothTrack, type Track, type TrackPoint, type TrackZone, type ZoneType } from "../track";

/** Kits de tema disponibles (decoración, colores). El cliente sabe dibujar cada uno. */
export type ThemeId = "pruebas" | "puerto";

export interface ZoneDef {
  type: ZoneType;
  /** Tramo de la vuelta en fracciones (0..1). */
  from: number;
  to: number;
  /** Franja lateral en metros (por defecto todo el ancho, arcén incluido). */
  lateralMin?: number;
  lateralMax?: number;
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
  /** Ancho del asfalto por defecto y arcén a cada lado (m). */
  width: number;
  verge: number;
  /** Puntos de control de la línea central (la curva pasa por ellos). El primero es la meta. */
  control: TrackPoint[];
  /** Filas de cajas de objetos, en fracciones de vuelta. */
  itemRows: number[];
  zones?: ZoneDef[];
  landmarks?: Landmark[];
  /** Semilla para colocar la decoración siempre igual. */
  seed: number;
}

export function buildTrackFromDef(def: TrackDef): Track {
  const track = smoothTrack(def.control, def.width, 3, def.verge);
  const outer = def.width / 2 + def.verge + 5;
  track.zones = (def.zones ?? []).map(
    (z): TrackZone => ({
      type: z.type,
      from: z.from * track.length,
      to: z.to * track.length,
      lateralMin: z.lateralMin ?? -outer,
      lateralMax: z.lateralMax ?? outer,
    }),
  );
  return track;
}
