import * as THREE from "three";
import {
  ITEMS,
  KART,
  PHYSICS_DT,
  TOUCH,
  botInput,
  collideKartWithTrack,
  createItemBoxes,
  createKart,
  createRaceKart,
  driftLevel,
  pointAt,
  pruebasTrack,
  racePositions,
  stepItems,
  stepKart,
  useItem,
  type BotDriver,
  type ItemEvent,
  type ItemWorld,
  type KartState,
  type RaceKart,
} from "@derrape/shared";
import { readInput } from "./input";
import { releaseTouch, setupTouchControls, takeItemAction } from "./input/touch";
import { CAMERA, ChaseCamera } from "./render/chaseCamera";
import { ItemsView } from "./render/itemsView";
import { createKartModel, type KartModel } from "./render/kartModel";
import { AutoQuality } from "./render/quality";
import { Sparks } from "./render/sparks";
import { createTrackMesh } from "./render/trackMesh";
import { createDebugPanel } from "./ui/debugPanel";
import { ITEM_NAMES, updateHud, updateItemSlot, updatePosition } from "./ui/hud";
import { setupMenu } from "./ui/menu";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const fpsLabel = document.querySelector<HTMLDivElement>("#fps")!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
const quality = new AutoQuality((ratio) => renderer.setPixelRatio(ratio));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0x8fd3ff, 80, 260);

const camera = new THREE.PerspectiveCamera(CAMERA.baseFov, 1, 0.1, 400);
const chase = new ChaseCamera(camera);

scene.add(new THREE.HemisphereLight(0xffffff, 0x5a8f3c, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(30, 60, 20);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(800, 800),
  new THREE.MeshLambertMaterial({ color: 0x6cbf4a }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- Pista ---
const track = pruebasTrack;
scene.add(createTrackMesh(track));

// --- Karts: el jugador y tres de prueba que corren solos (dianas para los objetos) ---
interface Racer {
  race: RaceKart;
  prev: KartState;
  model: KartModel;
  bot?: BotDriver;
  tuning: typeof KART;
  driftVisual: number;
  spinVisual: number;
}

function addRacer(id: number, distance: number, lateral: number, color: number, bot?: BotDriver, speed = 1): Racer {
  const p = pointAt(track, distance, lateral);
  const state = createKart(p.x, p.z, p.heading);
  const model = createKartModel(color);
  scene.add(model.root);
  return {
    race: createRaceKart(id, state, track),
    prev: { ...state },
    model,
    bot,
    // Los de prueba son algo más lentos; KART se lee en vivo para el jugador (panel F1).
    tuning: bot ? { ...KART, maxSpeed: KART.maxSpeed * speed } : KART,
    driftVisual: 0,
    spinVisual: 0,
  };
}

const player = addRacer(0, 0, 0, 0xff6b35);
const racers: Racer[] = [
  player,
  addRacer(1, 25, 3, 0x2e86de, { lane: 3, lookAhead: 10 }, 0.78),
  addRacer(2, 45, -3, 0x2ecc71, { lane: -3, lookAhead: 10 }, 0.82),
  addRacer(3, 65, 0, 0x9b5de5, { lane: 0, lookAhead: 10 }, 0.86),
];

const world: ItemWorld = {
  track,
  karts: racers.map((r) => r.race),
  boxes: createItemBoxes(track, [0.12, 0.38, 0.62, 0.86], 4),
  oils: [],
  rockets: [],
  random: Math.random,
};
const itemsView = new ItemsView(world);
scene.add(itemsView.group);

const sparks = new Sparks();
scene.add(sparks.points);

createDebugPanel({ kart: KART, items: ITEMS, camera: CAMERA, touch: TOUCH });
setupTouchControls(document.querySelector<HTMLDivElement>("#touch-zone")!);

let paused = false;
/** Mismo criterio que el aviso "pon el móvil en vertical" del CSS: en horizontal el juego se detiene. */
const wrongOrientation = matchMedia("(orientation: landscape) and (pointer: coarse)");

// Mensajes cortos en el centro de la pantalla.
const flash = document.querySelector<HTMLDivElement>("#item-flash")!;
function showFlash(text: string) {
  flash.textContent = text;
  flash.hidden = true;
  void flash.offsetWidth; // reinicia la animación
  flash.hidden = false;
}

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

setupMenu((p) => {
  paused = p;
  releaseTouch();
  quality.reset();
});

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// --- Bucle: física a paso fijo + render interpolado ---
let accumulator = 0;
let last = performance.now();
let frames = 0;
let fpsStart = last;
let time = 0;
const wheelWorld = new THREE.Vector3();

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function emitFromWheels(model: KartModel, level: number, count: number) {
  for (const w of model.rearWheels) {
    wheelWorld.copy(w);
    model.body.localToWorld(wheelWorld);
    sparks.emit(wheelWorld, level, count);
  }
}

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

  accumulator += dt;
  const input = readInput();
  for (let a = takeItemAction(); a; a = takeItemAction()) {
    const events: ItemEvent[] = [];
    useItem(world, player.race, a, events);
    onItemEvents(events);
  }
  while (accumulator >= PHYSICS_DT) {
    for (const r of racers) {
      const s = r.race.state;
      Object.assign(r.prev, s);
      stepKart(s, r.bot ? botInput(r.bot, s, track) : input, PHYSICS_DT, r.tuning);
      collideKartWithTrack(s, track, r.tuning);
    }
    onItemEvents(stepItems(world, PHYSICS_DT));
    accumulator -= PHYSICS_DT;
  }
  const alpha = accumulator / PHYSICS_DT;

  // --- Dibujar ---
  for (const r of racers) {
    const s = r.race.state;
    const x = r.prev.x + (s.x - r.prev.x) * alpha;
    const z = r.prev.z + (s.z - r.prev.z) * alpha;
    const m = r.model;
    m.root.position.set(x, 0, z);
    m.root.rotation.y = lerpAngle(r.prev.heading, s.heading, alpha);
    r.driftVisual += (s.driftDir * KART.driftVisualAngle - r.driftVisual) * Math.min(1, dt * 10);
    // Trompo: dos vueltas completas mientras dura.
    r.spinVisual = s.spinTime > 0 ? r.spinVisual + dt * Math.PI * 4 : 0;
    m.body.rotation.y = r.driftVisual + r.spinVisual;
    m.body.rotation.z = -r.driftVisual * 0.15;
    m.shield.visible = s.shieldTime > 0;
    if (s.shieldTime > 0 && s.shieldTime < 2) m.shield.visible = Math.floor(time * 8) % 2 === 0;

    const level = driftLevel(s);
    if (s.driftDir !== 0 && level > 0) emitFromWheels(m, level, 2);
    if (s.boostTime > 0) emitFromWheels(m, 2, 1);
  }
  sparks.update(dt);
  itemsView.update(world, dt);

  const me = player.race.state;
  const px = player.prev.x + (me.x - player.prev.x) * alpha;
  const pz = player.prev.z + (me.z - player.prev.z) * alpha;
  chase.update(px, pz, lerpAngle(player.prev.heading, me.heading, alpha), me.speed / KART.maxSpeed, dt);
  renderer.render(scene, camera);

  updateHud(Math.abs(me.speed) * 3.6, driftLevel(me), me.boostTime > 0);
  updateItemSlot(player.race.item, player.race.rollTime > 0, time);
  updatePosition(racePositions(world.karts).get(player.race.id)!, racers.length);

  frames++;
  if (now - fpsStart >= 500) {
    const fps = (frames * 1000) / (now - fpsStart);
    quality.report(fps, (now - fpsStart) / 1000);
    fpsLabel.textContent = `${Math.round(fps)} fps · x${quality.pixelRatio}`;
    frames = 0;
    fpsStart = now;
  }
});
