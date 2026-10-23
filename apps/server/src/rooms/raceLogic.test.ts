import { describe, expect, it } from "vitest";
import {
  KART,
  RACE,
  buildTrackFromDef,
  findTrack,
  gridPose,
  pointAt,
  type NetKartState,
  type Track,
} from "@derrape/shared";
import { FINISH_GRACE, RaceLogic } from "./raceLogic";

function net(x: number, z: number, respawns = 0): NetKartState {
  return { x, z, heading: 0, speed: 20, driftDir: 0, driftLevel: 0, hop: 0, boosting: false, spinning: false, shield: false, respawns };
}

const gridPoseX = (track: Track, slot: number) => gridPose(track, slot).x;
const gridPoseZ = (track: Track, slot: number) => gridPose(track, slot).z;

async function loadTrack(id: string): Promise<Track> {
  return buildTrackFromDef(await findTrack(id)!.load());
}

/** Sala con dos jugadores ya en carrera (pasada la cuenta atrás). Devuelve el reloj. */
async function racingRoom() {
  const room = new RaceLogic("ABCD");
  room.addPlayer("a", "Ana");
  room.addPlayer("b", "Beto");
  room.setTrack("a", "pruebas");
  const start = await room.startRace("a", 0);
  expect(typeof start).not.toBe("string");
  room.tick(RACE.countdown * 1000);
  expect(room.phase).toBe("racing");
  return { room, now: RACE.countdown * 1000 };
}

/**
 * Hace avanzar a un jugador por la pista a `speed` m/s mandando estados cada 50 ms,
 * desde su sitio en la parrilla, durante `seconds`. Devuelve el reloj final.
 */
function drive(room: RaceLogic, track: Track, id: string, slot: number, from: number, seconds: number, speed: number) {
  // Distancia inicial: la de la parrilla (negativa, detrás de la meta), igual que gridPose.
  let d = -6 - Math.floor(slot / 2) * 6 - (slot % 2 === 1 ? 3 : 0);
  let now = from;
  for (let t = 0; t < seconds; t += 0.05) {
    d += speed * 0.05;
    now = from + t * 1000;
    const p = pointAt(track, d);
    room.onState(id, net(p.x, p.z), now);
  }
  return now;
}

describe("sala", () => {
  it("el primero en entrar es el anfitrión y cada uno tiene un color distinto", () => {
    const room = new RaceLogic("ABCD");
    room.addPlayer("a", "Ana", 2);
    room.addPlayer("b", "Beto", 2); // quiere el mismo color
    const lobby = room.lobby();
    expect(lobby.players.find((p) => p.id === "a")!.host).toBe(true);
    expect(lobby.players[0]!.color).toBe(2);
    expect(lobby.players[1]!.color).not.toBe(2);
  });

  it("no deja coger un color ocupado", () => {
    const room = new RaceLogic("ABCD");
    room.addPlayer("a", "Ana", 0);
    room.addPlayer("b", "Beto", 1);
    expect(room.setProfile("b", undefined, 0)).toMatch(/color/);
    expect(room.setProfile("b", "Bea", 3)).toBeNull();
    expect(room.lobby().players[1]).toMatchObject({ name: "Bea", color: 3 });
  });

  it("los nombres se limpian y tienen un máximo", () => {
    const room = new RaceLogic("ABCD");
    room.addPlayer("a", "   ");
    room.addPlayer("b", "Un nombre larguísimo de verdad");
    const [a, b] = room.lobby().players;
    expect(a!.name).toBe("Piloto");
    expect(b!.name.length).toBeLessThanOrEqual(12);
  });

  it("máximo 8 jugadores", () => {
    const room = new RaceLogic("ABCD");
    for (let i = 0; i < 8; i++) room.addPlayer(`p${i}`, `P${i}`);
    expect(() => room.addPlayer("p8", "P8")).toThrow();
  });

  it("si el anfitrión se va, manda el siguiente", () => {
    const room = new RaceLogic("ABCD");
    room.addPlayer("a", "Ana");
    room.addPlayer("b", "Beto");
    room.removePlayer("a");
    expect(room.host).toBe("b");
    room.addPlayer("c", "Cris");
    room.setConnected("b", false);
    expect(room.host).toBe("c");
  });

  it("solo el anfitrión empieza, y con al menos 2 jugadores", async () => {
    const room = new RaceLogic("ABCD");
    room.addPlayer("a", "Ana");
    expect(await room.startRace("a", 0)).toMatch(/al menos/);
    room.addPlayer("b", "Beto");
    expect(await room.startRace("b", 0)).toMatch(/anfitrión/);
    const msg = await room.startRace("a", 0);
    expect(msg).toMatchObject({ trackId: room.trackId, seconds: RACE.countdown, grid: ["a", "b"] });
    expect(room.phase).toBe("countdown");
  });

  it("solo el anfitrión elige circuito y tiene que existir", () => {
    const room = new RaceLogic("ABCD");
    room.addPlayer("a", "Ana");
    room.addPlayer("b", "Beto");
    expect(room.setTrack("b", "pruebas")).not.toBeNull();
    expect(room.setTrack("a", "no-existe")).not.toBeNull();
    expect(room.setTrack("a", "pruebas")).toBeNull();
    expect(room.lobby().trackId).toBe("pruebas");
  });
});

describe("carrera", () => {
  it("la cuenta atrás pasa a carrera a su hora", async () => {
    const room = new RaceLogic("ABCD");
    room.addPlayer("a", "Ana");
    room.addPlayer("b", "Beto");
    await room.startRace("a", 1000);
    room.tick(1000 + RACE.countdown * 1000 - 1);
    expect(room.phase).toBe("countdown");
    room.tick(1000 + RACE.countdown * 1000);
    expect(room.phase).toBe("racing");
  });

  it("cuenta vueltas con los estados de los clientes y ordena por posición", async () => {
    const { room, now } = await racingRoom();
    const track = await loadTrack("pruebas");
    drive(room, track, "a", 0, now, 10, 20);
    drive(room, track, "b", 1, now, 10, 15);
    const snap = room.snapshot(now + 10_000);
    expect(snap.karts.find((k) => k.id === "a")).toMatchObject({ position: 1, lap: 1 });
    expect(snap.karts.find((k) => k.id === "b")).toMatchObject({ position: 2 });
  });

  it("termina cuando todos llegan y da los resultados en orden", async () => {
    const { room, now } = await racingRoom();
    const track = await loadTrack("pruebas");
    const lapsTime = (track.length * 3 + 40) / KART.maxSpeed;
    drive(room, track, "a", 0, now, lapsTime, KART.maxSpeed);
    expect(room.tick(now + lapsTime * 1000)).toBeNull(); // falta "b"
    const end = drive(room, track, "b", 1, now, lapsTime + 5, KART.maxSpeed * 0.95);
    const results = room.tick(end);
    expect(results?.results.map((r) => r.id)).toEqual(["a", "b"]);
    expect(results!.results[0]!.time).toBeGreaterThan(0);
    expect(room.phase).toBe("lobby");
  });

  it(`si alguien no llega, la carrera acaba ${FINISH_GRACE} s después del primero`, async () => {
    const { room, now } = await racingRoom();
    const track = await loadTrack("pruebas");
    const lapsTime = (track.length * 3 + 40) / KART.maxSpeed;
    const finish = drive(room, track, "a", 0, now, lapsTime, KART.maxSpeed);
    drive(room, track, "b", 1, now, 5, 10); // "b" se queda atrás
    expect(room.tick(finish + 1000)).toBeNull();
    const results = room.tick(finish + FINISH_GRACE * 1000 + 100);
    expect(results?.results).toMatchObject([
      { id: "a", position: 1 },
      { id: "b", position: 2, time: null },
    ]);
  });

  it("quien no manda estados no aparece por delante de los que corren", async () => {
    const { room, now } = await racingRoom();
    const track = await loadTrack("pruebas");
    // Solo "b" (segundo en parrilla) corre; "a" se ha quedado sin conexión en la salida.
    drive(room, track, "b", 1, now, 3, 15);
    room.onState("a", net(gridPoseX(track, 0), gridPoseZ(track, 0)), now); // un único estado parado
    const snap = room.snapshot(now + 3000);
    expect(snap.karts.find((k) => k.id === "b")!.position).toBe(1);
  });

  it("un salto imposible (teletransporte) no cuenta para el progreso", async () => {
    const { room, now } = await racingRoom();
    const track = await loadTrack("pruebas");
    drive(room, track, "a", 0, now, 2, 20);
    const far = pointAt(track, track.length * 0.6);
    room.onState("a", net(far.x, far.z), now + 2100);
    const lapBefore = room.snapshot(now + 2100).karts.find((k) => k.id === "a")!;
    expect(lapBefore.lap).toBe(1);
    // Pero reaparecer (respawns cambia) sí se acepta como salto legítimo.
    const back = pointAt(track, 5);
    room.onState("a", net(back.x, back.z, 1), now + 2200);
    expect(room.snapshot(now + 2200).karts.find((k) => k.id === "a")!.s.respawns).toBe(1);
  });

  it("ignora estados con datos basura", async () => {
    const { room, now } = await racingRoom();
    room.onState("a", { ...net(0, 0), x: Number.NaN }, now);
    room.onState("a", "hola" as unknown as NetKartState, now);
    expect(room.snapshot(now).karts.find((k) => k.id === "a")).toBeUndefined();
  });
});
