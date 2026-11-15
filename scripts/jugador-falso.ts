// Jugador falso para probar el multijugador sin un segundo móvil.
//
//   npx tsx scripts/jugador-falso.ts CODIGO [nombre] [servidor] [personaje] [coche]
//
// Se une a la sala, espera a que el anfitrión empiece y da vueltas al circuito mandando su
// estado 20 veces por segundo, como haría un amigo de verdad (sin derrapes). Usa los objetos
// que le da el servidor al cabo de un momento, hacia delante o hacia atrás al azar.

import { Client } from "colyseus.js";
import {
  ITEMS,
  KART,
  MSG,
  NET_SEND_HZ,
  PHYSICS_DT,
  ROOM_RACE,
  SERVER_PORT,
  botInput,
  buildTrackFromDef,
  createKart,
  findTrack,
  giveBoost,
  gridPose,
  normalizeRoomCode,
  stepKartOnTrack,
  type CountdownMessage,
  type ItemEventsMessage,
  type StatesMessage,
  type NetKartState,
  type Track,
} from "@derrape/shared";

const code = normalizeRoomCode(process.argv[2] ?? "");
const name = process.argv[3] ?? "Robotín";
const endpoint = process.argv[4] ?? `ws://localhost:${SERVER_PORT}`;
const character = process.argv[5] ?? "tocho";
const kartId = process.argv[6] ?? "tanque";
if (!code) {
  console.error("Uso: npx tsx scripts/jugador-falso.ts CODIGO [nombre] [servidor]");
  process.exit(1);
}

const room = await new Client(endpoint).joinById(code, { name, color: 6, character, kart: kartId });
console.log(`${name} está en la sala ${code}. Esperando a que el anfitrión empiece…`);

let timer: ReturnType<typeof setInterval> | null = null;
for (const type of [MSG.lobby, MSG.error]) room.onMessage(type, () => {});

// Objetos: el servidor dice qué lleva; se usa al cabo de 1–3 s.
let kart: ReturnType<typeof createKart> | null = null;
let useAt: number | null = null;
room.onMessage(MSG.states, (m: StatesMessage) => {
  const me = m.karts.find((k) => k.id === room.sessionId);
  if (!me?.item || me.rolling) {
    useAt = null;
    return;
  }
  useAt ??= Date.now() + 1000 + Math.random() * 2000;
  if (Date.now() >= useAt) {
    const action = Math.random() < 0.5 ? "forward" : "back";
    console.log(`Usa ${me.item} (${action === "forward" ? "adelante" : "atrás"})`);
    room.send(MSG.useItem, { action });
    useAt = Date.now() + 5000; // por si se pierde el mensaje
  }
});
room.onMessage(MSG.itemEvents, (m: ItemEventsMessage) => {
  for (const e of m.events) {
    if (e.kart !== room.sessionId || !kart) continue;
    if (e.type === "hit") {
      kart.spinTime = e.by === "oil" ? ITEMS.oilSpinTime : ITEMS.rocketSpinTime;
      console.log(`¡Le han dado (${e.by})!`);
    }
    if (e.type === "blocked") kart.shieldTime = 0;
    if (e.type === "use" && e.item === "nitro") giveBoost(kart, ITEMS.nitroTime, ITEMS.nitroSpeedMult);
    if (e.type === "use" && e.item === "shield") kart.shieldTime = ITEMS.shieldTime;
  }
});
room.onMessage(MSG.results, () => {
  console.log("Carrera terminada. Esperando a la siguiente…");
  if (timer) clearInterval(timer);
});

room.onMessage(MSG.countdown, async (m: CountdownMessage) => {
  const track: Track = buildTrackFromDef(await findTrack(m.trackId)!.load());
  const slot = Math.max(0, m.grid.indexOf(room.sessionId));
  const pose = gridPose(track, slot);
  const s = createKart(pose.x, pose.z, pose.heading);
  kart = s;
  const lane = (slot % 2 === 0 ? 1 : -1) * 2;
  const tuning = { ...KART, maxSpeed: KART.maxSpeed * 0.92 };
  let clock = 0;
  console.log(`¡Carrera en ${m.trackId}! Saliendo desde la posición ${slot + 1}.`);

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    // Varios pasos de física por envío, como el bucle del juego.
    for (let i = 0; i < Math.round(1 / NET_SEND_HZ / PHYSICS_DT); i++) {
      clock += PHYSICS_DT;
      if (clock < m.seconds) continue; // parado en la cuenta atrás
      stepKartOnTrack(s, botInput({ lane, lookAhead: 12 }, s, track), PHYSICS_DT, track, tuning);
    }
    const state: NetKartState = {
      x: s.x,
      z: s.z,
      heading: s.heading,
      speed: s.speed,
      driftDir: 0,
      driftLevel: 0,
      hop: 0,
      y: s.airborne ? s.y : s.groundY + s.climb,
      vy: s.vy,
      boosting: s.boostTime > 0,
      spinning: s.spinTime > 0,
      shield: s.shieldTime > 0,
      respawns: 0,
    };
    room.send(MSG.state, state);
  }, 1000 / NET_SEND_HZ);
});

process.on("SIGINT", async () => {
  await room.leave();
  process.exit(0);
});
