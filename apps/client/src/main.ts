import * as THREE from "three";
import {
  KART,
  PHYSICS_DT,
  collideKartWithTrack,
  createKart,
  createOvalTrack,
  driftLevel,
  startPose,
  stepKart,
  type KartState,
} from "@derrape/shared";
import { readInput } from "./input";
import { releaseTouch, setupTouchControls } from "./input/touch";
import { CAMERA, ChaseCamera } from "./render/chaseCamera";
import { createKartModel } from "./render/kartModel";
import { AutoQuality } from "./render/quality";
import { Sparks } from "./render/sparks";
import { createTrackMesh } from "./render/trackMesh";
import { createDebugPanel } from "./ui/debugPanel";
import { updateHud } from "./ui/hud";
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
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshLambertMaterial({ color: 0x6cbf4a }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- Pista y kart ---
const track = createOvalTrack();
scene.add(createTrackMesh(track));

const start = startPose(track);
const kart: KartState = createKart(start.x, start.z, start.heading);
const prev: KartState = { ...kart };
const model = createKartModel();
scene.add(model.root);
const sparks = new Sparks();
scene.add(sparks.points);

createDebugPanel({ kart: KART, camera: CAMERA });
setupTouchControls(document.body);

let paused = false;
/** Mismo criterio que el aviso "gira el móvil" del CSS: en vertical el juego se detiene. */
const portrait = matchMedia("(orientation: portrait) and (pointer: coarse)");
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
let driftVisual = 0;
const wheelWorld = new THREE.Vector3();

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (paused || portrait.matches) {
    accumulator = 0;
    fpsStart = now;
    frames = 0;
    return;
  }

  accumulator += dt;
  const input = readInput();
  while (accumulator >= PHYSICS_DT) {
    Object.assign(prev, kart);
    stepKart(kart, input, PHYSICS_DT);
    collideKartWithTrack(kart, track);
    accumulator -= PHYSICS_DT;
  }
  const alpha = accumulator / PHYSICS_DT;

  const x = prev.x + (kart.x - prev.x) * alpha;
  const z = prev.z + (kart.z - prev.z) * alpha;
  const heading = lerpAngle(prev.heading, kart.heading, alpha);

  model.root.position.set(x, 0, z);
  model.root.rotation.y = heading;
  driftVisual += (kart.driftDir * KART.driftVisualAngle - driftVisual) * Math.min(1, dt * 10);
  model.body.rotation.y = driftVisual;
  model.body.rotation.z = -driftVisual * 0.15;

  const level = driftLevel(kart);
  if (kart.driftDir !== 0) {
    for (const w of model.rearWheels) {
      wheelWorld.copy(w);
      model.body.localToWorld(wheelWorld);
      sparks.emit(wheelWorld, Math.max(level, 0), level > 0 ? 2 : 0);
    }
  }
  if (kart.boostTime > 0) {
    for (const w of model.rearWheels) {
      wheelWorld.copy(w);
      model.body.localToWorld(wheelWorld);
      sparks.emit(wheelWorld, 2, 1);
    }
  }
  sparks.update(dt);

  chase.update(x, z, heading, kart.speed / KART.maxSpeed, dt);
  renderer.render(scene, camera);

  updateHud(Math.abs(kart.speed) * 3.6, level, kart.boostTime > 0);

  frames++;
  if (now - fpsStart >= 500) {
    const fps = (frames * 1000) / (now - fpsStart);
    quality.report(fps, (now - fpsStart) / 1000);
    fpsLabel.textContent = `${Math.round(fps)} fps · x${quality.pixelRatio}`;
    frames = 0;
    fpsStart = now;
  }
});
