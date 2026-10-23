// Reglas de la carrera: checkpoints en orden, vueltas, tiempos, reaparición y salida con turbo.

import { giveBoost, type KartState } from "./kart";
import { pointAt, type Track } from "./track";
import { RACE } from "./tuning";

/** Progreso de un kart en la carrera. */
export interface LapProgress {
  /** Vuelta actual (0 = aún no ha cruzado la salida). */
  lap: number;
  /** Siguiente checkpoint que tiene que pisar (el 0 está en la meta). */
  next: number;
  /** Momento en que empezó la vuelta actual (s desde la salida). */
  lapStart: number;
  lapTimes: number[];
  /** Tiempo total al terminar, o null. */
  finishTime: number | null;
  /** Distancia en la vuelta del último checkpoint pisado: ahí se reaparece. */
  respawnDistance: number;
  /** Segundos casi parado (para reaparecer si se atasca). */
  stuckTime: number;
}

export type ProgressEvent = "lap" | "finish" | null;

/** Número de checkpoints de una pista (uno cada ~50 m, mínimo 8). */
export function checkpointCount(track: Track): number {
  return Math.max(8, Math.round(track.length / RACE.checkpointSpacing));
}

export function createProgress(): LapProgress {
  return { lap: 0, next: 0, lapStart: 0, lapTimes: [], finishTime: null, respawnDistance: 0, stuckTime: 0 };
}

/**
 * Actualiza el progreso con la distancia actual en la vuelta. Solo cuenta pisar los checkpoints
 * en orden: no se puede atajar ni ir marcha atrás para sumar vueltas.
 */
export function updateProgress(p: LapProgress, track: Track, distance: number, time: number, laps: number): ProgressEvent {
  if (p.finishTime !== null) return null;
  const n = checkpointCount(track);
  const sector = Math.floor((distance / track.length) * n) % n;
  if (sector !== p.next) return null;

  p.respawnDistance = (sector / n) * track.length;
  p.next = (p.next + 1) % n;
  if (sector !== 0) return null;

  // Ha cruzado la meta.
  if (p.lap > 0) {
    p.lapTimes.push(time - p.lapStart);
    p.lapStart = time;
  }
  p.lap++;
  if (p.lap > laps) {
    p.finishTime = time;
    return "finish";
  }
  return p.lap > 1 ? "lap" : null;
}

/** Pone el kart en el último checkpoint, parado y mirando hacia delante. */
export function respawnKart(s: KartState, p: LapProgress, track: Track): void {
  // Un poco por delante del checkpoint para no volver a caer en lo mismo.
  const pose = pointAt(track, p.respawnDistance + 2);
  s.x = pose.x;
  s.z = pose.z;
  s.heading = pose.heading;
  s.speed = 0;
  s.driftDir = 0;
  s.driftCharge = 0;
  s.hopTime = 0;
  s.spinTime = 0;
  s.boostTime = 0;
  p.stuckTime = 0;
}

/** ¿Hay que reaparecer? (caída o atasco). Llamar cada paso durante la carrera. */
export function needsRespawn(s: KartState, p: LapProgress, dt: number): boolean {
  if (s.surface === "fall") return true;
  p.stuckTime = Math.abs(s.speed) < RACE.stuckSpeed && s.spinTime === 0 ? p.stuckTime + dt : 0;
  return p.stuckTime >= RACE.stuckTime;
}

export type StartResult = "perfect" | "good" | "stall" | "normal";

/**
 * Salida con turbo. `holdFrom` = segundo de la cuenta atrás (0..countdown) en que se empezó
 * a mantener el acelerador sin soltarlo hasta la salida; null si no se mantenía.
 * Como en la referencia: empezar justo al salir el "2" da el mejor turbo; antes, el motor se cala.
 */
export function startResult(holdFrom: number | null): StartResult {
  if (holdFrom === null) return "normal";
  if (holdFrom < RACE.startPerfectFrom) return "stall";
  if (holdFrom <= RACE.startPerfectTo) return "perfect";
  if (holdFrom <= RACE.startGoodTo) return "good";
  return "normal";
}

/** Aplica el resultado de la salida. Devuelve los segundos que el kart queda calado. */
export function applyStart(s: KartState, result: StartResult): number {
  if (result === "perfect") giveBoost(s, RACE.startPerfectBoost, RACE.startBoostMult);
  if (result === "good") giveBoost(s, RACE.startGoodBoost, RACE.startBoostMult);
  return result === "stall" ? RACE.startStallTime : 0;
}

/** Clasificación: primero los que han terminado (por tiempo), luego por distancia recorrida. */
export function standings<T extends { progress: LapProgress; raceDistance: number }>(karts: T[]): T[] {
  return [...karts].sort((a, b) => {
    const fa = a.progress.finishTime;
    const fb = b.progress.finishTime;
    if (fa !== null && fb !== null) return fa - fb;
    if (fa !== null) return -1;
    if (fb !== null) return 1;
    return b.raceDistance - a.raceDistance;
  });
}

/** "1:05.32" */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}
