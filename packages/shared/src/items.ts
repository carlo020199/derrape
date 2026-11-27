// Objetos: cajas, reparto según posición, Nitro, Aceite, Cohete y Escudo.
// Lógica pura: hoy la ejecuta el cliente en solitario; en multijugador la ejecutará el servidor.

import { giveBoost, type KartState } from "./kart";
import { closestPoint, pointAt, type Track } from "./track";
import { ITEM_ODDS, ITEMS } from "./tuning";

export type ItemType = "nitro" | "oil" | "rocket" | "shield";
export const ITEM_TYPES: readonly ItemType[] = ["nitro", "oil", "rocket", "shield"];

/** Cómo se usa: toque, deslizar arriba (adelante) o deslizar abajo (atrás). */
export type ItemAction = "use" | "forward" | "back";

export interface RaceKart {
  id: number;
  state: KartState;
  item: ItemType | null;
  /** Ruleta: mientras sea > 0 el objeto aún no se puede usar. */
  rollTime: number;
  /** Metros recorridos desde la salida (suma vueltas). Sirve para las posiciones. */
  raceDistance: number;
  /** Última distancia en la vuelta (0..length), para detectar el paso por meta. */
  trackDistance: number;
  /**
   * Posición que se tuvo en cuenta en el último `stepItems`: el barrido de cajas y aceite va de aquí a la
   * posición actual (ver `distanceToSegment`). Sin definir, el kart solo cuenta en su posición.
   */
  prevX?: number;
  prevZ?: number;
}

export interface ItemBox {
  x: number;
  z: number;
  /** Segundos hasta reaparecer (0 = disponible). */
  respawn: number;
}

export interface OilSlick {
  /** Identificador estable (para reconocerla entre instantáneas de red). */
  id: number;
  x: number;
  z: number;
  owner: number;
  /** El dueño no resbala con su propio aceite mientras sea > 0. */
  safeTime: number;
}

export interface Rocket {
  id: number;
  owner: number;
  /** Distancia a lo largo de la pista (misma escala que raceDistance). */
  distance: number;
  lateral: number;
  /** 1 = sentido de la carrera, -1 = hacia atrás. */
  dir: 1 | -1;
  target: number | null;
  life: number;
  x: number;
  z: number;
}

/** Lo que pasó en un paso, para efectos visuales y sonido. */
export type ItemEvent =
  | { type: "pickup"; kart: number }
  | { type: "hit"; kart: number; by: "oil" | "rocket"; owner: number }
  | { type: "blocked"; kart: number }
  | { type: "use"; kart: number; item: ItemType };

export interface ItemWorld {
  track: Track;
  karts: RaceKart[];
  boxes: ItemBox[];
  oils: OilSlick[];
  rockets: Rocket[];
  /** Generador aleatorio (0..1). Inyectable para tests y para el servidor. */
  random: () => number;
  /** Siguiente id para aceite y cohetes. */
  nextId?: number;
}

/** Distancia (m) del punto (px, pz) al segmento (ax, az)→(bx, bz). */
export function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * u), pz - (az + dz * u));
}

/**
 * Distancia de un kart a un punto fijo (caja, aceite) por barrido: mínima entre el punto y el segmento que
 * recorrió desde el último paso. Con el servidor a 20 Hz y un kart a 78 m/s, el segmento mide 3,9 m (más que
 * el diámetro de una caja): sin barrido las atraviesa sin recogerlas. Un salto de más de `ITEMS.sweepMax`
 * (reaparecer) es un teletransporte y no barre nada.
 */
function sweptDistance(k: RaceKart, x: number, z: number): number {
  const { x: bx, z: bz } = k.state;
  const ax = k.prevX ?? bx;
  const az = k.prevZ ?? bz;
  if (Math.hypot(bx - ax, bz - az) > ITEMS.sweepMax) return Math.hypot(bx - x, bz - z);
  return distanceToSegment(x, z, ax, az, bx, bz);
}

function newId(world: ItemWorld): number {
  world.nextId = (world.nextId ?? 0) + 1;
  return world.nextId;
}

export function createRaceKart(id: number, state: KartState, track: Track): RaceKart {
  const d = closestPoint(track, state.x, state.z).distance;
  // Los que salen detrás de la meta empiezan con distancia negativa.
  const raceDistance = d > track.length / 2 ? d - track.length : d;
  return { id, state, item: null, rollTime: 0, raceDistance, trackDistance: d };
}

/** Filas de cajas a lo ancho de la pista, en las fracciones de vuelta indicadas. */
export function createItemBoxes(track: Track, rows: number[], perRow = 4): ItemBox[] {
  const boxes: ItemBox[] = [];
  const usable = track.width - 4;
  for (const f of rows) {
    for (let i = 0; i < perRow; i++) {
      const lateral = perRow === 1 ? 0 : -usable / 2 + (usable * i) / (perRow - 1);
      const p = pointAt(track, f * track.length, lateral);
      boxes.push({ x: p.x, z: p.z, respawn: 0 });
    }
  }
  return boxes;
}

/** Sorteo de objeto según la posición (1 = primero). */
export function rollItem(position: number, total: number, random: () => number): ItemType {
  const ratio = total <= 1 ? 0.5 : (position - 1) / (total - 1);
  const odds = ratio < 0.34 ? ITEM_ODDS.front : ratio < 0.67 ? ITEM_ODDS.middle : ITEM_ODDS.back;
  const sum = ITEM_TYPES.reduce((acc, t) => acc + odds[t], 0);
  let r = random() * sum;
  for (const t of ITEM_TYPES) {
    r -= odds[t];
    if (r < 0) return t;
  }
  return ITEM_TYPES[ITEM_TYPES.length - 1]!;
}

/** Posición en carrera (1 = primero) de cada kart, por id. */
export function racePositions(karts: RaceKart[]): Map<number, number> {
  const sorted = [...karts].sort((a, b) => b.raceDistance - a.raceDistance);
  return new Map(sorted.map((k, i) => [k.id, i + 1]));
}

function hitKart(k: RaceKart, by: "oil" | "rocket", owner: number, events: ItemEvent[]) {
  if (k.state.spinTime > 0) return;
  if (k.state.shieldTime > 0) {
    k.state.shieldTime = 0;
    events.push({ type: "blocked", kart: k.id });
    return;
  }
  k.state.spinTime = by === "oil" ? ITEMS.oilSpinTime : ITEMS.rocketSpinTime;
  events.push({ type: "hit", kart: k.id, by, owner });
}

/** Usa el objeto del kart (si tiene y ya pasó la ruleta). Devuelve true si se usó. */
export function useItem(world: ItemWorld, kart: RaceKart, action: ItemAction, events: ItemEvent[] = []): boolean {
  const item = kart.item;
  if (!item || kart.rollTime > 0) return false;
  kart.item = null;
  const s = kart.state;
  const c = closestPoint(world.track, s.x, s.z);

  switch (item) {
    case "nitro":
      giveBoost(s, ITEMS.nitroTime, ITEMS.nitroSpeedMult);
      break;
    case "shield":
      s.shieldTime = ITEMS.shieldTime;
      break;
    case "oil": {
      const ahead = action === "forward";
      const p = pointAt(world.track, c.distance + (ahead ? ITEMS.oilThrowDistance : -ITEMS.oilDropBack), c.lateral);
      world.oils.push({ id: newId(world), x: p.x, z: p.z, owner: kart.id, safeTime: ahead ? 0 : 1 });
      if (world.oils.length > ITEMS.maxOils) world.oils.shift();
      break;
    }
    case "rocket": {
      const dir = action === "back" ? -1 : 1;
      let target: number | null = null;
      if (dir === 1) {
        // El kart más cercano por delante.
        let best = Infinity;
        for (const k of world.karts) {
          const gap = k.raceDistance - kart.raceDistance;
          if (k.id !== kart.id && gap > 0 && gap < best) {
            best = gap;
            target = k.id;
          }
        }
      }
      world.rockets.push({
        id: newId(world),
        owner: kart.id,
        distance: kart.raceDistance + dir * 2.5,
        lateral: c.lateral,
        dir,
        target,
        life: ITEMS.rocketLife,
        x: s.x,
        z: s.z,
      });
      break;
    }
  }
  events.push({ type: "use", kart: kart.id, item });
  return true;
}

/** Avanza cajas, ruletas, aceite y cohetes. Llamar después de mover los karts. */
export function stepItems(world: ItemWorld, dt: number): ItemEvent[] {
  const events: ItemEvent[] = [];
  const { track, karts } = world;

  // Progreso en carrera de cada kart.
  for (const k of karts) {
    const d = closestPoint(track, k.state.x, k.state.z).distance;
    let delta = d - k.trackDistance;
    if (delta > track.length / 2) delta -= track.length;
    if (delta < -track.length / 2) delta += track.length;
    k.raceDistance += delta;
    k.trackDistance = d;
    k.rollTime = Math.max(0, k.rollTime - dt);
  }

  // Cajas.
  const positions = racePositions(karts);
  for (const box of world.boxes) {
    if (box.respawn > 0) {
      box.respawn = Math.max(0, box.respawn - dt);
      continue;
    }
    for (const k of karts) {
      if (sweptDistance(k, box.x, box.z) > ITEMS.boxRadius) continue;
      box.respawn = ITEMS.boxRespawn;
      if (k.item === null) {
        k.item = rollItem(positions.get(k.id)!, karts.length, world.random);
        k.rollTime = ITEMS.rollTime;
        events.push({ type: "pickup", kart: k.id });
      }
      break;
    }
  }

  // Aceite.
  world.oils = world.oils.filter((oil) => {
    oil.safeTime = Math.max(0, oil.safeTime - dt);
    for (const k of karts) {
      if (k.id === oil.owner && oil.safeTime > 0) continue;
      if (sweptDistance(k, oil.x, oil.z) <= ITEMS.oilRadius) {
        hitKart(k, "oil", oil.owner, events);
        return false;
      }
    }
    return true;
  });

  // Cohetes: avanzan a lo largo de la pista y se acercan al carril del objetivo.
  world.rockets = world.rockets.filter((r) => {
    r.life -= dt;
    if (r.life <= 0) return false;
    r.distance += r.dir * ITEMS.rocketSpeed * dt;
    const target = r.target === null ? undefined : karts.find((k) => k.id === r.target);
    if (target) {
      const targetLateral = closestPoint(track, target.state.x, target.state.z).lateral;
      r.lateral += (targetLateral - r.lateral) * Math.min(1, ITEMS.rocketHoming * dt);
      // Si lo adelanta, se pega a él en vez de pasarse.
      if (r.distance > target.raceDistance) r.distance = target.raceDistance;
    }
    const p = pointAt(track, r.distance, r.lateral);
    r.x = p.x;
    r.z = p.z;
    for (const k of karts) {
      if (k.id === r.owner && r.life > ITEMS.rocketLife - 0.5) continue;
      if (Math.hypot(k.state.x - r.x, k.state.z - r.z) <= ITEMS.rocketHitRadius) {
        hitKart(k, "rocket", r.owner, events);
        return false;
      }
    }
    return true;
  });

  // El siguiente barrido empieza donde acaba este. Los cohetes no barren: se pegan a su objetivo.
  for (const k of karts) {
    k.prevX = k.state.x;
    k.prevZ = k.state.z;
  }

  return events;
}
