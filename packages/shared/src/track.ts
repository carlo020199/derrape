// Pista: línea central cerrada con altura, ancho y peralte por punto, arcén y zonas especiales.
// Sin relieve (`relief` false, bank 0 y rampas sin tamaño) la física sigue siendo 2D:
// la altura solo se dibuja y las rampas hacen el salto de duración fija.

import { bounceKart, giveBoost, stepKart, type KartInput, type KartState } from "./kart";
import { GRIP, KART, RAMP, SURFACE, type KartTuning, type RampSize } from "./tuning";

export interface TrackPoint {
  x: number;
  z: number;
  /** Altura de la línea central (m). Sin relieve, solo se dibuja. */
  y?: number;
  /** Ancho del asfalto en este punto (m). Si falta, el de la pista. */
  w?: number;
  /**
   * Peralte en grados. + = la curva gira a la izquierda y se levanta el borde derecho.
   * Si falta, 0: la carretera queda plana, como hasta ahora.
   */
  bank?: number;
}

/** Tipos de zona especial reutilizables por cualquier circuito. */
export type ZoneType = "slow" | "lowGrip" | "boostPad" | "fall" | "ramp";

export interface TrackZone {
  type: ZoneType;
  /** Tramo de la vuelta (m desde la salida). Si `to` < `from`, cruza la meta. */
  from: number;
  to: number;
  /** Franja lateral (m a la izquierda del centro). Por defecto, todo el ancho. */
  lateralMin: number;
  lateralMax: number;
  /** Rampa con vuelo real. Sin tamaño, el salto dura lo de siempre. */
  size?: RampSize;
}

/**
 * Obstáculo periódico (p. ej. tren en un paso a nivel).
 * Activo durante `active` segundos de cada `period` (con desfase `phase`).
 */
export interface TrackHazard {
  type: "gate";
  from: number;
  to: number;
  lateralMin: number;
  lateralMax: number;
  period: number;
  active: number;
  phase: number;
}

export interface Track {
  /** Línea central cerrada (el último punto conecta con el primero), con y/w ya rellenos. */
  points: Required<TrackPoint>[];
  /** Distancia acumulada desde la salida hasta cada punto (m). */
  lengths: number[];
  /** Longitud de una vuelta (m). */
  length: number;
  /** Ancho por defecto del asfalto (m). */
  width: number;
  /** Arcén a cada lado del asfalto antes del muro (m). En el arcén se va lento. */
  verge: number;
  zones: TrackZone[];
  hazards: TrackHazard[];
  /**
   * El circuito usa peralte, cuestas y rampas con tamaño.
   * En false, un kart se conduce igual que antes (bank 0 y rampas sin `size`).
   */
  relief: boolean;
}

export type Surface = "road" | "offroad" | ZoneType;

export interface ClosestPoint {
  x: number;
  z: number;
  y: number;
  /** Ancho del asfalto en ese punto. */
  width: number;
  /** Peralte en grados en ese punto. */
  bank: number;
  /** Distancia con signo al centro: positiva a la izquierda según el sentido de la pista. */
  lateral: number;
  /** Índice del segmento. */
  segment: number;
  /** Distancia recorrida a lo largo de la pista desde la salida (0..length). */
  distance: number;
}

export function buildTrack(
  points: TrackPoint[],
  width: number,
  verge = 0,
  zones: TrackZone[] = [],
  hazards: TrackHazard[] = [],
): Track {
  const full = points.map((p) => ({ x: p.x, z: p.z, y: p.y ?? 0, w: p.w ?? width, bank: p.bank ?? 0 }));
  const lengths: number[] = [0];
  for (let i = 1; i <= full.length; i++) {
    const a = full[i - 1]!;
    const b = full[i % full.length]!;
    lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const length = lengths.pop()!;
  return { points: full, lengths, length, width, verge, zones, hazards, relief: false };
}

/** Óvalo de prueba: dos rectas unidas por semicírculos. */
export function createOvalTrack(straight = 120, radius = 45, width = 16, segmentsPerCurve = 32): Track {
  const points: TrackPoint[] = [];
  const half = straight / 2;
  // Recta derecha hacia +Z, curva arriba, recta izquierda hacia -Z, curva abajo.
  for (let i = 0; i <= segmentsPerCurve; i++) {
    const a = (i / segmentsPerCurve) * Math.PI;
    points.push({ x: radius * Math.cos(a), z: half + radius * Math.sin(a) });
  }
  for (let i = 0; i <= segmentsPerCurve; i++) {
    const a = Math.PI + (i / segmentsPerCurve) * Math.PI;
    points.push({ x: radius * Math.cos(a), z: -half + radius * Math.sin(a) });
  }
  return buildTrack(points, width);
}

/**
 * Curva suave y cerrada que pasa por los puntos de control (Catmull-Rom),
 * remuestreada a puntos separados `spacing` metros. Interpola también altura y ancho.
 */
export function smoothTrack(control: TrackPoint[], width: number, spacing = 3, verge = 0): Track {
  const n = control.length;
  const c = control.map((p) => ({ x: p.x, z: p.z, y: p.y ?? 0, w: p.w ?? width, bank: p.bank ?? 0 }));
  const dense: Required<TrackPoint>[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = c[(i - 1 + n) % n]!;
    const p1 = c[i]!;
    const p2 = c[(i + 1) % n]!;
    const p3 = c[(i + 2) % n]!;
    const steps = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / 0.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, cc: number, d: number) =>
        0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      dense.push({
        x: f(p0.x, p1.x, p2.x, p3.x),
        z: f(p0.z, p1.z, p2.z, p3.z),
        y: f(p0.y, p1.y, p2.y, p3.y),
        w: p1.w + (p2.w - p1.w) * t,
        bank: p1.bank + (p2.bank - p1.bank) * t,
      });
    }
  }
  // Remuestrear a distancia constante para que los segmentos sean parecidos.
  const fine = buildTrack(dense, width);
  const count = Math.max(8, Math.round(fine.length / spacing));
  const points: TrackPoint[] = [];
  for (let i = 0; i < count; i++) {
    const p = pointAt(fine, (i / count) * fine.length);
    points.push({ x: p.x, z: p.z, y: p.y, w: p.width, bank: p.bank });
  }
  // La curva a veces comprime un cambio de peralte por encima de 2°/m.
  // Se reparte con los vecinos. Con bank 0 (el resto de circuitos) no hace nada.
  capBankRate(points, 1.95);
  return buildTrack(points, width, verge);
}

/** Reparte los saltos de peralte más bruscos que `maxPerMeter` grados por metro. */
function capBankRate(points: TrackPoint[], maxPerMeter: number) {
  const n = points.length;
  for (let pass = 0; pass < 12; pass++) {
    let hot = false;
    for (let i = 0; i < n; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % n]!;
      const ds = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const maxDelta = maxPerMeter * ds;
      const delta = (b.bank ?? 0) - (a.bank ?? 0);
      if (Math.abs(delta) > maxDelta + 1e-4) {
        const excess = (Math.abs(delta) - maxDelta) / 2;
        const sign = Math.sign(delta);
        a.bank = (a.bank ?? 0) + sign * excess;
        b.bank = (b.bank ?? 0) - sign * excess;
        hot = true;
      }
    }
    if (!hot) break;
  }
}

/** Lleva una distancia cualquiera al rango 0..length. */
export function wrapDistance(track: Track, d: number): number {
  return ((d % track.length) + track.length) % track.length;
}

/** Punto a `distance` metros desde la salida, desplazado `lateral` metros a la izquierda. */
export function pointAt(
  track: Track,
  distance: number,
  lateral = 0,
): { x: number; z: number; y: number; width: number; bank: number; heading: number } {
  const d = wrapDistance(track, distance);
  const { points, lengths } = track;
  // Búsqueda binaria del segmento.
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lengths[mid]! <= d) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo]!;
  const b = points[(lo + 1) % points.length]!;
  const segLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const u = (d - lengths[lo]!) / segLen;
  const dx = (b.x - a.x) / segLen;
  const dz = (b.z - a.z) / segLen;
  // Normal izquierda (dz, -dx): la del sentido en que gira el kart con rumbo positivo.
  return {
    x: a.x + (b.x - a.x) * u + dz * lateral,
    z: a.z + (b.z - a.z) * u - dx * lateral,
    y: a.y + (b.y - a.y) * u,
    width: a.w + (b.w - a.w) * u,
    bank: a.bank + (b.bank - a.bank) * u,
    heading: Math.atan2(dx, dz),
  };
}

export function closestPoint(track: Track, x: number, z: number): ClosestPoint {
  const pts = track.points;
  let best = 0;
  let bestU = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
    const d2 = (x - (a.x + dx * u)) ** 2 + (z - (a.z + dz * u)) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
      bestU = u;
    }
  }
  const a = pts[best]!;
  const b = pts[(best + 1) % pts.length]!;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const px = a.x + dx * bestU;
  const pz = a.z + dz * bestU;
  // Producto cruzado: >0 si el punto está a la izquierda del segmento.
  const side = Math.sign(dz * (x - a.x) - dx * (z - a.z)) || 1;
  return {
    x: px,
    z: pz,
    y: a.y + (b.y - a.y) * bestU,
    width: a.w + (b.w - a.w) * bestU,
    bank: a.bank + (b.bank - a.bank) * bestU,
    lateral: Math.sqrt(bestD2) * side,
    segment: best,
    distance: track.lengths[best]! + Math.hypot(dx, dz) * bestU,
  };
}

function inSpan(from: number, to: number, distance: number): boolean {
  return from <= to ? distance >= from && distance <= to : distance >= from || distance <= to;
}

function inZone(zone: TrackZone, c: ClosestPoint): boolean {
  if (c.lateral < zone.lateralMin || c.lateral > zone.lateralMax) return false;
  return inSpan(zone.from, zone.to, c.distance);
}

/** Superficie bajo el kart: las zonas especiales mandan; si no, asfalto o arcén. */
export function surfaceAt(track: Track, c: ClosestPoint): Surface {
  for (const z of track.zones) if (inZone(z, c)) return z.type;
  return Math.abs(c.lateral) <= c.width / 2 ? "road" : "offroad";
}

/** ¿Hay un obstáculo (tren, barrera) activo en este punto a este tiempo de carrera? */
export function hazardActiveAt(track: Track, c: ClosestPoint, raceTime: number): TrackHazard | null {
  for (const h of track.hazards) {
    if (c.lateral < h.lateralMin || c.lateral > h.lateralMax) continue;
    if (!inSpan(h.from, h.to, c.distance)) continue;
    const t = ((raceTime + h.phase) % h.period + h.period) % h.period;
    if (t < h.active) return h;
  }
  return null;
}

/**
 * Mantiene el kart dentro de los muros (asfalto + arcén) y devuelve el punto más cercano,
 * que también sirve para saber la superficie y el progreso.
 */
export function collideKartWithTrack(s: KartState, track: Track, t: KartTuning = KART): ClosestPoint {
  const c = closestPoint(track, s.x, s.z);
  const limit = c.width / 2 + track.verge - t.radius;
  const dist = Math.abs(c.lateral);
  s.outsideWall = false;
  if (dist <= limit) return c;
  // En el aire los muros solo llegan hasta su altura. En L1 hay uno invisible de 4 m.
  if (s.airborne) {
    const above = s.y - surfaceY(c);
    const wall = tallWallAt(track, c.distance) ? RAMP.tallWall : RAMP.wallHeight;
    if (above >= wall) return c;
  }
  // El muro exterior de un peralte frena menos: el peralte recoge el kart.
  s.outsideWall = s.bank !== 0 && Math.sign(c.lateral) === -Math.sign(s.bank);
  // Normal hacia el centro de la pista.
  const nx = (c.x - s.x) / dist;
  const nz = (c.z - s.z) / dist;
  bounceKart(s, nx, nz, dist - limit, t);
  return { ...c, lateral: Math.sign(c.lateral) * limit };
}

/** Posición y rumbo de salida: inicio del primer segmento, mirando a lo largo de la pista. */
export function startPose(track: Track): { x: number; z: number; heading: number } {
  return pointAt(track, 0);
}

/**
 * Parrilla: dos columnas detrás de la meta.
 * La fila de atrás va a 10 m (la cámara de persecución está a ~7,5 m): si no,
 * ese kart queda entre la cámara y el piloto y se ve enorme, pegado al objetivo.
 */
export function gridPose(track: Track, slot: number): { x: number; z: number; heading: number } {
  const row = Math.floor(slot / 2);
  const side = slot % 2 === 0 ? 1 : -1;
  const lateral = side * Math.min(3, track.width / 4);
  return pointAt(track, -6 - row * 10 - (side < 0 ? 3 : 0), lateral);
}

/** Altura de la calzada en un punto. Con bank 0 coincide con la línea central. */
export function surfaceY(c: { y: number; lateral: number; bank?: number }): number {
  const bank = ((c.bank ?? 0) * Math.PI) / 180;
  return c.y - c.lateral * Math.tan(bank);
}

/** Normal de la calzada (pendiente + peralte), apuntando hacia arriba. */
export function surfaceNormal(track: Track, c: ClosestPoint): { x: number; y: number; z: number } {
  const a = pointAt(track, c.distance - 2);
  const b = pointAt(track, c.distance + 2);
  const tx = b.x - a.x;
  const ty = b.y - a.y;
  const tz = b.z - a.z;
  const h = Math.hypot(tx, tz) || 1;
  const lx = tz / h;
  const lz = -tx / h;
  const ay = -Math.tan(((c.bank ?? 0) * Math.PI) / 180);
  let nx = ty * lz - tz * ay;
  let ny = tz * lx - tx * lz;
  let nz = tx * ay - ty * lx;
  const len = Math.hypot(nx, ny, nz) || 1;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** Seno de la pendiente en el rumbo del kart. Positivo = cuesta arriba. 0 si el circuito no tiene relieve. */
export function gradeAlong(track: Track, c: ClosestPoint, heading: number): number {
  if (!track.relief) return 0;
  const ahead = pointAt(track, c.distance + 1.5);
  const behind = pointAt(track, c.distance - 1.5);
  const dx = ahead.x - behind.x;
  const dz = ahead.z - behind.z;
  const dy = ahead.y - behind.y;
  const horiz = Math.hypot(dx, dz) || 1;
  const pitch = Math.atan2(dy, horiz);
  const trackH = Math.atan2(dx, dz);
  let align = heading - trackH;
  while (align > Math.PI) align -= Math.PI * 2;
  while (align < -Math.PI) align += Math.PI * 2;
  return Math.sin(pitch) * Math.cos(align);
}

/** Metros hacia delante por la pista, de `from` a `to` (0 .. length). */
export function forwardDelta(length: number, from: number, to: number): number {
  return ((to - from) % length + length) % length;
}

function crossedLip(length: number, lip: number, from: number, to: number): boolean {
  const d = forwardDelta(length, from, to);
  if (d <= 0.001 || d > 25) return false;
  return forwardDelta(length, from, lip) <= d;
}

function rampAt(track: Track, distance: number): TrackZone | null {
  for (const z of track.zones) {
    if (z.type === "ramp" && z.size && inSpan(z.from, z.to, distance)) return z;
  }
  return null;
}

function tallWallAt(track: Track, distance: number): boolean {
  for (const z of track.zones) {
    if (z.type !== "ramp" || z.size !== "L") continue;
    const end = (z.to + RAMP.tallSpan) % track.length;
    if (inSpan(z.from, end, distance)) return true;
  }
  return false;
}

function curveRadius(track: Track, distance: number): number {
  const a = pointAt(track, distance - 8);
  const b = pointAt(track, distance);
  const c = pointAt(track, distance + 8);
  const ab = Math.hypot(b.x - a.x, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.z - b.z);
  const ac = Math.hypot(c.x - a.x, c.z - a.z);
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  if (area2 < 1e-3) return Infinity;
  return (ab * bc * ac) / (2 * area2);
}

/** Velocidad de paso con el peralte de ese punto. Rectas (R > 140 m) no tienen tope. */
function cornerSpeed(radius: number, bankDeg: number): number {
  if (!Number.isFinite(radius) || radius > 140) return Infinity;
  const t = Math.tan((Math.abs(bankDeg) * Math.PI) / 180);
  if (GRIP.mu * t >= 0.98) return Infinity;
  return Math.sqrt(Math.max(0, (GRIP.g * radius * (GRIP.mu + t)) / (1 - GRIP.mu * t)));
}

function gripCapAt(track: Track, distance: number, speed: number): number {
  const look = Math.max(10, Math.abs(speed) * 0.45);
  let cap = Infinity;
  for (const d of [0, look * 0.5, look]) {
    const at = distance + d;
    cap = Math.min(cap, cornerSpeed(curveRadius(track, at), pointAt(track, at).bank));
  }
  return Number.isFinite(cap) ? cap : 0;
}

function rampClimb(track: Track, zone: TrackZone, distance: number): number {
  const spec = RAMP[zone.size!];
  const span = forwardDelta(track.length, zone.from, zone.to);
  if (span < 0.4 || span > 40) return 0;
  const into = forwardDelta(track.length, zone.from, distance);
  if (into > span) return 0;
  return spec.lip * (into / span);
}

function beginFlight(s: KartState, c: ClosestPoint, size: RampSize) {
  const spec = RAMP[size];
  const th = Math.atan(spec.lip / spec.len);
  const pitch = Math.asin(Math.max(-1, Math.min(1, s.grade)));
  s.airborne = true;
  s.flightRamp = size;
  s.trick = false;
  s.vy = s.speed * Math.sin(th + pitch);
  s.y = surfaceY(c) + spec.lip;
  s.climb = 0;
  s.hopTime = 0;
  s.hopTotal = 0;
  s.rampSize = null;
}

function landKart(s: KartState, track: Track, c: ClosestPoint) {
  const ground = surfaceY(c);
  const kartPitch = Math.atan2(s.vy, Math.max(1, Math.abs(s.speed)));
  const trackPitch = Math.asin(Math.max(-1, Math.min(1, gradeAlong(track, c, s.heading))));
  const clean = Math.abs(kartPitch - trackPitch) < (15 * Math.PI) / 180;
  if (s.trick && s.flightRamp) giveBoost(s, RAMP[s.flightRamp].trick, KART.boostSpeedMult);
  s.airborne = false;
  s.y = ground;
  s.vy = 0;
  s.climb = 0;
  s.trick = false;
  s.flightRamp = null;
  s.groundY = ground;
  return clean;
}

/**
 * Un paso de kart que conoce la pista: peralte, cuesta y vuelo en rampas con tamaño.
 * Sin relieve hace lo mismo que `stepKart` + `collideKartWithTrack` (bank 0, sin vuelo).
 * Devuelve el punto de pista tras el paso. `clean` es true si el aterrizaje de este paso
 * fue suave (cabeceo a menos de 15° de la pista).
 */
export function stepKartOnTrack(
  s: KartState,
  input: KartInput,
  dt: number,
  track: Track,
  t: KartTuning = KART,
): ClosestPoint & { cleanLanding: boolean } {
  const before = closestPoint(track, s.x, s.z);
  const prevAlong = s.along < 0 ? before.distance : s.along;
  if (track.relief && !s.airborne) {
    s.bank = before.bank;
    s.grade = gradeAlong(track, before, s.heading);
    s.groundY = surfaceY(before);
    s.gripCap = gripCapAt(track, before.distance, s.speed);
    const ramp = rampAt(track, before.distance);
    s.rampSize = ramp?.size ?? null;
    s.climb = ramp ? rampClimb(track, ramp, before.distance) : 0;
  } else if (!s.airborne) {
    s.bank = 0;
    s.grade = 0;
    s.rampSize = null;
    s.climb = 0;
    s.groundY = before.y;
    s.gripCap = 0;
  } else if (track.relief) {
    s.bank = before.bank;
    s.grade = 0;
    s.rampSize = null;
    s.climb = 0;
    s.gripCap = 0;
  }
  stepKart(s, input, dt, t);
  const c = collideKartWithTrack(s, track, t);
  let cleanLanding = false;
  if (s.airborne && s.y <= surfaceY(c)) cleanLanding = landKart(s, track, c);
  if (!s.airborne && track.relief) {
    for (const z of track.zones) {
      if (z.type !== "ramp" || !z.size) continue;
      if (!crossedLip(track.length, z.to, prevAlong, c.distance)) continue;
      if (s.speed < SURFACE.rampMinSpeed || s.driftDir !== 0) continue;
      const lip = pointAt(track, z.to);
      beginFlight(s, { ...c, y: lip.y, bank: lip.bank, lateral: 0 }, z.size);
    }
  }
  s.along = c.distance;
  s.surface = s.airborne ? "road" : surfaceAt(track, c);
  if (!s.airborne) s.groundY = surfaceY(c);
  return { ...c, cleanLanding };
}
