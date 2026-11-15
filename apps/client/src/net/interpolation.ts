// Interpolación de karts remotos: se dibujan ~100 ms en el pasado, mezclando las dos instantáneas
// que rodean ese momento. Así se ven fluidos aunque los estados lleguen a saltos (20/s) y con retraso.

import type { ItemsSnapshot, NetKartState } from "@derrape/shared";

/** Retraso con el que se dibujan los karts remotos (ms). */
export const INTERP_DELAY = 100;
/** Si faltan datos, se extrapola como mucho esto (ms) y luego se espera quieto. */
const MAX_EXTRAPOLATION = 200;
const MAX_ITEMS = 40;

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class SnapshotBuffer {
  private items: { t: number; s: NetKartState }[] = [];

  push(t: number, s: NetKartState) {
    const last = this.items[this.items.length - 1];
    if (last && t <= last.t) return; // llegó desordenado o repetido
    this.items.push({ t, s });
    if (this.items.length > MAX_ITEMS) this.items.shift();
  }

  get latest(): NetKartState | null {
    return this.items[this.items.length - 1]?.s ?? null;
  }

  /** Estado en el instante `t` (reloj del servidor). */
  sample(t: number): NetKartState | null {
    const items = this.items;
    if (items.length === 0) return null;
    const first = items[0]!;
    if (t <= first.t) return first.s;
    for (let i = items.length - 1; i > 0; i--) {
      const a = items[i - 1]!;
      const b = items[i]!;
      if (t >= a.t && t <= b.t) {
        // Si ha reaparecido entre medias, no se interpola (sería un deslizamiento raro por el mapa).
        if (a.s.respawns !== b.s.respawns) return b.s;
        const u = (t - a.t) / (b.t - a.t || 1);
        return {
          ...b.s,
          x: a.s.x + (b.s.x - a.s.x) * u,
          z: a.s.z + (b.s.z - a.s.z) * u,
          heading: lerpAngle(a.s.heading, b.s.heading, u),
          speed: a.s.speed + (b.s.speed - a.s.speed) * u,
          hop: a.s.hop + (b.s.hop - a.s.hop) * u,
          y: (a.s.y ?? 0) + ((b.s.y ?? 0) - (a.s.y ?? 0)) * u,
          vy: (a.s.vy ?? 0) + ((b.s.vy ?? 0) - (a.s.vy ?? 0)) * u,
        };
      }
    }
    // Más allá de lo último que ha llegado: extrapolar un poco con su velocidad y rumbo.
    const last = items[items.length - 1]!;
    const ahead = Math.min(t - last.t, MAX_EXTRAPOLATION) / 1000;
    return {
      ...last.s,
      x: last.s.x + Math.sin(last.s.heading) * last.s.speed * ahead,
      z: last.s.z + Math.cos(last.s.heading) * last.s.speed * ahead,
      y: (last.s.y ?? 0) + (last.s.vy ?? 0) * ahead,
    };
  }
}

/**
 * Estimación del reloj del servidor. Cada mensaje con hora del servidor da una muestra
 * "hora servidor − hora local al recibirlo"; se sube rápido (paquete que llegó antes) y se baja
 * despacio (paquete retrasado), para no dar tirones con el jitter.
 */
export class ServerClock {
  private offset: number | null = null;

  sample(serverTime: number, localNow: number) {
    const o = serverTime - localNow;
    if (this.offset === null) this.offset = o;
    else this.offset += (o - this.offset) * (o > this.offset ? 0.5 : 0.02);
  }

  now(localNow: number): number | null {
    return this.offset === null ? null : localNow + this.offset;
  }
}

/**
 * Objetos en pista según el servidor. Se dibujan con el mismo retraso que los karts remotos;
 * los cohetes (rápidos) se interpolan reconociéndolos por su id.
 */
export class ItemsBuffer {
  private items: { t: number; s: ItemsSnapshot }[] = [];

  push(t: number, s: ItemsSnapshot) {
    const last = this.items[this.items.length - 1];
    if (last && t <= last.t) return;
    this.items.push({ t, s });
    if (this.items.length > MAX_ITEMS) this.items.shift();
  }

  sample(t: number): ItemsSnapshot | null {
    const items = this.items;
    if (items.length === 0) return null;
    let i = items.length - 1;
    while (i > 0 && items[i]!.t > t) i--;
    const a = items[i]!;
    const b = items[i + 1];
    if (!b || t <= a.t) return a.s;
    const u = (t - a.t) / (b.t - a.t || 1);
    const before = new Map(a.s.rockets.map((r) => [r.id, r]));
    return {
      ...a.s,
      // Un cohete que aún no existía en `a` no se dibuja hasta su momento; uno que ya explotó, tampoco.
      rockets: b.s.rockets.flatMap((r) => {
        const old = before.get(r.id);
        return old ? [{ id: r.id, x: old.x + (r.x - old.x) * u, z: old.z + (r.z - old.z) * u }] : [];
      }),
    };
  }
}
