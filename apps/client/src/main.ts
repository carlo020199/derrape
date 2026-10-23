import * as THREE from "three";
import {
  DEFAULT_TRACK,
  ITEMS,
  KART,
  PHYSICS_DT,
  RACE,
  SURFACE,
  TOUCH,
  TRACKS,
  applyStart,
  botInput,
  buildTrackFromDef,
  collideKartWithTrack,
  createItemBoxes,
  createKart,
  createProgress,
  createRaceKart,
  driftLevel,
  findTrack,
  formatTime,
  gridPose,
  hopHeight,
  needsRespawn,
  pointAt,
  respawnKart,
  standings,
  startResult,
  stepItems,
  stepKart,
  surfaceAt,
  updateProgress,
  useItem,
  type BotDriver,
  type ItemEvent,
  type ItemWorld,
  type KartState,
  type LapProgress,
  type RaceKart,
  type Track,
  type TrackDef,
} from "@derrape/shared";
import { readInput } from "./input";
import { readKeyboard } from "./input/keyboard";
import { releaseTouch, setupTouchControls, takeItemAction, touch } from "./input/touch";
import { CAMERA, ChaseCamera } from "./render/chaseCamera";
import { ItemsView } from "./render/itemsView";
import { createKartModel, type KartModel } from "./render/kartModel";
import { AutoQuality } from "./render/quality";
import { Sparks } from "./render/sparks";
import { THEMES } from "./render/themes";
import { createTrackMesh } from "./render/trackMesh";
import { createDebugPanel } from "./ui/debugPanel";
import { ITEM_NAMES, updateHud, updateItemSlot, updatePosition } from "./ui/hud";
import { setupMenu } from "./ui/menu";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const canvas = $<HTMLCanvasElement>("#game");
const fpsLabel = $<HTMLDivElement>("#fps");
const lapLabel = $<HTMLDivElement>("#lap");
const timeLabel = $<HTMLDivElement>("#race-time");
const countdownEl = $<HTMLDivElement>("#countdown");
const wrongWayEl = $<HTMLDivElement>("#wrong-way");
const flash = $<HTMLDivElement>("#item-flash");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
const quality = new AutoQuality((ratio) => renderer.setPixelRatio(ratio));
const camera = new THREE.PerspectiveCamera(CAMERA.baseFov, 1, 0.1, 500);
const chase = new ChaseCamera(camera);

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function showFlash(text: string) {
  flash.textContent = text;
  flash.hidden = true;
  void flash.offsetWidth; // reinicia la animación
  flash.hidden = false;
}

// --- Selector de circuito y reinicio (en el menú de ajustes) ---
const params = new URLSearchParams(location.search);
const entry = findTrack(params.get("pista") ?? DEFAULT_TRACK) ?? findTrack(DEFAULT_TRACK)!;
const trackSelect = $<HTMLSelectElement>("#track-select");
for (const t of TRACKS) trackSelect.add(new Option(t.number ? `${t.number}. ${t.name}` : t.name, t.id, false, t.id === entry.id));
trackSelect.addEventListener("change", () => {
  location.search = `?pista=${encodeURIComponent(trackSelect.value)}`;
});

interface Racer {
  name: string;
  race: RaceKart;
  progress: LapProgress;
  prev: KartState;
  model: KartModel;
  bot?: BotDriver;
  tuning: typeof KART;
  driftVisual: number;
  spinVisual: number;
  /** Altura de la pista bajo el kart. */
  y: number;
  /** Segundos calado tras una mala salida. */
  stall: number;
  wrongWay: number;
}

const BOT_SETUP = [
  { name: "Azul", color: 0x2e86de, lane: 3, speed: 0.9 },
  { name: "Verde", color: 0x2ecc71, lane: -3, speed: 0.93 },
  { name: "Morado", color: 0x9b5de5, lane: 0, speed: 0.95 },
];

async function start() {
  const def: TrackDef = await entry.load();
  const track: Track = buildTrackFromDef(def);
  const theme = THEMES[def.theme];

  // --- Escena ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.sky, theme.fog[0], theme.fog[1]);
  scene.add(new THREE.HemisphereLight(0xffffff, theme.ground, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(30, 60, 20);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ color: theme.ground }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = theme.track.groundY;
  scene.add(ground);
  scene.add(createTrackMesh(track, theme.track));
  theme.decorate(scene, track, def);

  // --- Karts ---
  function makeRacer(slot: number, name: string, color: number, bot?: BotDriver, speed = 1): Racer {
    const model = createKartModel(color);
    scene.add(model.root);
    const pose = gridPose(track, slot);
    const state = createKart(pose.x, pose.z, pose.heading);
    return {
      name,
      race: createRaceKart(slot, state, track),
      progress: createProgress(),
      prev: { ...state },
      model,
      bot,
      // Los de prueba son algo más lentos; KART se lee en vivo para el jugador (panel F1).
      tuning: bot ? { ...KART, maxSpeed: KART.maxSpeed * speed } : KART,
      driftVisual: 0,
      spinVisual: 0,
      y: 0,
      stall: 0,
      wrongWay: 0,
    };
  }
  const player = makeRacer(0, "Tú", 0xff6b35);
  const racers = [player, ...BOT_SETUP.map((b, i) => makeRacer(i + 1, b.name, b.color, { lane: b.lane, lookAhead: 12 }, b.speed))];

  const world: ItemWorld = {
    track,
    karts: racers.map((r) => r.race),
    boxes: createItemBoxes(track, def.itemRows, 4),
    oils: [],
    rockets: [],
    random: Math.random,
  };
  const itemsView = new ItemsView(world);
  scene.add(itemsView.group);
  const sparks = new Sparks();
  scene.add(sparks.points);

  createDebugPanel({ kart: KART, race: RACE, surface: SURFACE, items: ITEMS, camera: CAMERA, touch: TOUCH });

  // --- Estado de la carrera ---
  let phase: "countdown" | "racing" | "finished" = "countdown";
  let countdown = 0;
  let raceTime = 0;
  let holdFrom: number | null = null;
  let lastCount = -1;
  let resultsShown = false;

  function resetRace() {
    racers.forEach((r, slot) => {
      const pose = gridPose(track, slot);
      const s = createKart(pose.x, pose.z, pose.heading);
      r.race = createRaceKart(slot, s, track);
      r.progress = createProgress();
      r.prev = { ...s };
      r.stall = 0;
      r.wrongWay = 0;
      if (r === player) r.bot = undefined;
    });
    world.karts = racers.map((r) => r.race);
    world.boxes = createItemBoxes(track, def.itemRows, 4);
    world.oils = [];
    world.rockets = [];
    phase = "countdown";
    countdown = 0;
    raceTime = 0;
    holdFrom = null;
    lastCount = -1;
    resultsShown = false;
    $("#results").hidden = true;
    chase.snap();
  }

  $("#results-again").addEventListener("click", resetRace);
  $("#menu-restart").addEventListener("click", () => {
    resetRace();
    $<HTMLButtonElement>("#menu-close").click();
  });

  /** Racers ordenados por posición en carrera. */
  const ranking = () =>
    standings(racers.map((r) => ({ r, progress: r.progress, raceDistance: r.race.raceDistance }))).map((x) => x.r);

  function onItemEvents(events: ItemEvent[]) {
    for (const e of events) {
      if (e.kart === player.race.id) {
        if (e.type === "hit") showFlash(e.by === "oil" ? "¡Aceite!" : "¡Cohete!");
        if (e.type === "blocked") showFlash("¡Escudo!");
        if (e.type === "use") showFlash(ITEM_NAMES[e.item]);
      } else if (e.type === "hit") {
        showFlash("¡Tocado!");
      }
    }
  }

  function showResults() {
    resultsShown = true;
    const list = $<HTMLOListElement>("#results-list");
    list.replaceChildren();
    ranking().forEach((r, i) => {
      const li = document.createElement("li");
      if (r === player) li.className = "me";
      const time = r.progress.finishTime;
      li.append(
        Object.assign(document.createElement("span"), { textContent: `${i + 1}º` }),
        Object.assign(document.createElement("span"), { textContent: r.name }),
        Object.assign(document.createElement("span"), { textContent: time === null ? "en carrera" : formatTime(time) }),
      );
      list.append(li);
    });
    const laps = player.progress.lapTimes;
    const best = Math.min(...laps);
    $("#results-laps").textContent = `Vueltas: ${laps.map(formatTime).join(" · ")} — mejor ${formatTime(best)}`;
    $("#results").hidden = false;
  }

  // --- Pausa ---
  let paused = false;
  const wrongOrientation = matchMedia("(orientation: landscape) and (pointer: coarse)");
  setupMenu((p) => {
    paused = p;
    releaseTouch();
    quality.reset();
  });

  $("#loading").hidden = true;

  // --- Bucle: física a paso fijo + render interpolado ---
  let accumulator = 0;
  let last = performance.now();
  let frames = 0;
  let fpsStart = last;
  let time = 0;
  const wheelWorld = new THREE.Vector3();

  const lerpAngle = (a: number, b: number, t: number) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };

  function emitFromWheels(model: KartModel, level: number, count: number) {
    for (const w of model.rearWheels) {
      wheelWorld.copy(w);
      model.body.localToWorld(wheelWorld);
      sparks.emit(wheelWorld, level, count);
    }
  }

  function stepCountdown(dt: number) {
    countdown += dt;
    // "Acelerador" en la salida: un dedo en la pantalla o la tecla de acelerar.
    const revving = touch.holding || readKeyboard().throttle;
    if (revving && holdFrom === null) holdFrom = countdown;
    if (!revving) holdFrom = null;

    if (countdown >= RACE.countdown) {
      phase = "racing";
      player.stall = applyStart(player.race.state, startResult(holdFrom));
      if (player.stall > 0) showFlash("¡Calado!");
      else if (startResult(holdFrom) === "perfect") showFlash("¡Salida perfecta!");
      // Los de prueba salen a veces con turbo.
      for (const r of racers) if (r.bot && r !== player) applyStart(r.race.state, Math.random() < 0.4 ? "perfect" : "normal");
    }
  }

  function stepPhysics() {
    const input = phase === "racing" && player.stall <= 0 ? readInput() : { steer: 0, throttle: false, brake: false, drift: false };
    for (const r of racers) {
      const s = r.race.state;
      Object.assign(r.prev, s);
      if (phase === "countdown") continue;
      r.stall = Math.max(0, r.stall - PHYSICS_DT);
      stepKart(s, r.bot ? botInput(r.bot, s, track) : input, PHYSICS_DT, r.tuning);
      const c = collideKartWithTrack(s, track, r.tuning);
      s.surface = surfaceAt(track, c);
      r.y = c.y;

      const event = updateProgress(r.progress, track, c.distance, raceTime, def.laps);
      if (r === player) {
        if (event === "lap" && r.progress.lap === def.laps) showFlash("¡Última vuelta!");
        if (event === "finish") {
          phase = "finished";
          showFlash(`¡Meta! ${ranking().indexOf(r) + 1}º`);
          // Al terminar, el kart sigue solo (como en la referencia).
          r.bot = { lane: 0, lookAhead: 12 };
        }
        // Dirección contraria durante más de 1 s.
        const forward = pointAt(track, c.distance).heading;
        const dot = Math.cos(s.heading - forward);
        r.wrongWay = dot < -0.3 && s.speed > 3 ? r.wrongWay + PHYSICS_DT : 0;
      }
      if (needsRespawn(s, r.progress, PHYSICS_DT)) {
        respawnKart(s, r.progress, track);
        Object.assign(r.prev, s);
        if (r === player) chase.snap();
      }
    }
    onItemEvents(stepItems(world, PHYSICS_DT));
    if (phase !== "countdown") raceTime += PHYSICS_DT;
  }

  function updateRaceHud() {
    const lap = Math.min(Math.max(player.progress.lap, 1), def.laps);
    lapLabel.textContent = `Vuelta ${lap}/${def.laps}`;
    const shownTime = player.progress.finishTime ?? raceTime;
    timeLabel.textContent = formatTime(shownTime);

    if (phase === "countdown") {
      const n = Math.ceil(RACE.countdown - countdown);
      if (n !== lastCount) {
        lastCount = n;
        countdownEl.textContent = String(n);
        countdownEl.hidden = false;
        countdownEl.classList.remove("pop");
        void countdownEl.offsetWidth;
        countdownEl.classList.add("pop");
      }
    } else if (lastCount !== 0) {
      lastCount = 0;
      countdownEl.textContent = "¡YA!";
      countdownEl.classList.remove("pop");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("pop");
    }
    wrongWayEl.hidden = player.wrongWay < 1;
  }

  resetRace();

  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (paused || wrongOrientation.matches) {
      accumulator = 0;
      fpsStart = now;
      frames = 0;
      return;
    }
    time += dt;

    if (phase === "countdown") stepCountdown(dt);
    for (let a = takeItemAction(); a; a = takeItemAction()) {
      if (phase !== "racing") continue;
      const events: ItemEvent[] = [];
      useItem(world, player.race, a, events);
      onItemEvents(events);
    }

    accumulator += dt;
    while (accumulator >= PHYSICS_DT) {
      stepPhysics();
      accumulator -= PHYSICS_DT;
    }
    const alpha = accumulator / PHYSICS_DT;

    // --- Dibujar ---
    for (const r of racers) {
      const s = r.race.state;
      const m = r.model;
      m.root.position.set(r.prev.x + (s.x - r.prev.x) * alpha, r.y + hopHeight(s), r.prev.z + (s.z - r.prev.z) * alpha);
      m.root.rotation.y = lerpAngle(r.prev.heading, s.heading, alpha);
      r.driftVisual += (s.driftDir * KART.driftVisualAngle - r.driftVisual) * Math.min(1, dt * 10);
      // Trompo: dos vueltas completas mientras dura.
      r.spinVisual = s.spinTime > 0 ? r.spinVisual + dt * Math.PI * 4 : 0;
      m.body.rotation.y = r.driftVisual + r.spinVisual;
      m.body.rotation.z = -r.driftVisual * 0.15;
      m.shield.visible = s.shieldTime > 0 && (s.shieldTime > 2 || Math.floor(time * 8) % 2 === 0);

      const level = driftLevel(s);
      if (s.driftDir !== 0 && level > 0) emitFromWheels(m, level, 2);
      if (s.boostTime > 0) emitFromWheels(m, 2, 1);
    }
    sparks.update(dt);
    itemsView.update(world, dt);

    const me = player.race.state;
    chase.update(
      player.model.root.position.x,
      player.y,
      player.model.root.position.z,
      player.model.root.rotation.y,
      me.speed / KART.maxSpeed,
      dt,
    );
    renderer.render(scene, camera);

    updateHud(Math.abs(me.speed) * 3.6, driftLevel(me), me.boostTime > 0);
    updateItemSlot(player.race.item, player.race.rollTime > 0, time);
    updatePosition(ranking().indexOf(player) + 1, racers.length);
    updateRaceHud();
    if (phase === "finished" && !resultsShown && raceTime - (player.progress.finishTime ?? 0) > 1.5) showResults();

    frames++;
    if (now - fpsStart >= 500) {
      const fps = (frames * 1000) / (now - fpsStart);
      quality.report(fps, (now - fpsStart) / 1000);
      fpsLabel.textContent = `${Math.round(fps)} fps · x${quality.pixelRatio}`;
      frames = 0;
      fpsStart = now;
    }
  });
}

setupTouchControls($<HTMLDivElement>("#touch-zone"));
void start();
