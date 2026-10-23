import * as THREE from "three";
import { PHYSICS_HZ } from "@derrape/shared";
import { MAX_PIXEL_RATIO } from "./render/quality";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const fpsLabel = document.querySelector<HTMLDivElement>("#fps")!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1f3a);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(0, 1.5, 4);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 5, 2);
scene.add(sun);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 1.4, 1.4),
  new THREE.MeshStandardMaterial({ color: 0xff6b35, flatShading: true }),
);
scene.add(cube);

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

console.log(`Derrape: física a ${PHYSICS_HZ} Hz`);

let frames = 0;
let fpsStart = performance.now();
let last = performance.now();

renderer.setAnimationLoop((now) => {
  const dt = (now - last) / 1000;
  last = now;

  cube.rotation.x += dt * 0.7;
  cube.rotation.y += dt * 1.1;
  renderer.render(scene, camera);

  frames++;
  if (now - fpsStart >= 500) {
    fpsLabel.textContent = `${Math.round((frames * 1000) / (now - fpsStart))} fps`;
    frames = 0;
    fpsStart = now;
  }
});
