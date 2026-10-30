import * as THREE from "three";
import { KART_COLORS } from "@derrape/shared";
import { createKartModel, type KartModel } from "./kartModel";

/**
 * Vista previa 3D del piloto y el coche elegidos, girando sobre una peana. Usa el mismo renderer que
 * la carrera (iOS limita los contextos WebGL) y se dibuja detrás de la pantalla de selección.
 */
export class GaragePreview {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private model: KartModel | null = null;
  private cheer = 0;
  private time = 0;
  private last = 0;
  private running = false;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private canvas: HTMLCanvasElement,
  ) {
    this.scene.background = new THREE.Color(0x2a3170);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4488, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 8, 6);
    this.scene.add(sun);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.6, 0.2, 32),
      new THREE.MeshLambertMaterial({ color: 0x1b1f3a }),
    );
    pedestal.position.y = -0.1;
    this.scene.add(pedestal);
    this.camera.position.set(3.4, 2.4, 5.2);
    this.camera.lookAt(0, 0.7, 0);
  }

  /** Cambia lo que se ve. `cheer` hace que el piloto celebre un momento. */
  set(character: string, kart: string, colorIndex: number, cheer = true) {
    if (this.model) {
      this.scene.remove(this.model.root);
    }
    const color = KART_COLORS[colorIndex] ?? KART_COLORS[0];
    const model = createKartModel(color, character, kart);
    model.root.rotation.y = this.model?.root.rotation.y ?? 0.6;
    this.scene.add(model.root);
    this.model = model;
    if (cheer) this.cheer = 1.4;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private frame(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // En vertical la pantalla es estrecha: se aleja la cámara para que quepa el coche entero.
    const dist = Math.max(6.6, Math.min(16, 6.97 / this.camera.aspect));
    this.camera.position.set(0.52, 0.36, 0.78).multiplyScalar(dist);
    this.camera.lookAt(0, 0.7, 0);
    // Sube el coche a la parte de arriba de la pantalla, que es la que no tapa el panel.
    this.camera.setViewOffset(w, h, 0, h * 0.3, w, h);
    this.camera.updateProjectionMatrix();

    if (this.model) {
      this.model.root.rotation.y += dt * 0.7;
      this.cheer = Math.max(0, this.cheer - dt);
      this.model.setMood(this.cheer > 0 ? "celebrate" : "idle", this.time);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
