import * as THREE from "three";
import { KART_COLORS } from "@derrape/shared";
import { createKartModel, type KartModel } from "./kartModel";
import { Fire, paintExhaust } from "./flames";
import { PALETTE, toonMaterial } from "./materials";
import { createGradientSky } from "./sky";

/**
 * Vista previa 3D del piloto y el coche elegidos, girando sobre una peana. Usa el mismo renderer que
 * la carrera (iOS limita los contextos WebGL) y se dibuja detrás de la pantalla de selección.
 */
export class GaragePreview {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private model: KartModel | null = null;
  private fire: Fire;
  private flameAt = new THREE.Vector3();
  private cheer = 0;
  private time = 0;
  private last = 0;
  private running = false;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private canvas: HTMLCanvasElement,
  ) {
    this.scene.background = new THREE.Color(0x1e1830);
    this.scene.add(createGradientSky(0x120f1e, 0x2e2547, 40));
    this.scene.add(new THREE.HemisphereLight(0x9a8cb8, 0x2e2547, 0.85));
    const sun = new THREE.DirectionalLight(0xffb423, 1.7);
    sun.position.set(4, 8, 6);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xcfc4ff, 0.55);
    fill.position.set(-5, 3, -2);
    this.scene.add(fill);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.6, 0.2, 32),
      toonMaterial({ color: 0xf3e7d3 }),
    );
    pedestal.position.y = -0.1;
    this.scene.add(pedestal);
    this.camera.position.set(3.4, 2.4, 5.2);
    this.camera.lookAt(0, 0.7, 0);
    this.fire = new Fire(this.scene);
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

    this.fire.begin();
    if (this.model) {
      this.model.root.rotation.y += dt * 0.7;
      this.cheer = Math.max(0, this.cheer - dt);
      this.model.setMood(this.cheer > 0 ? "celebrate" : "idle", this.time);
      const grow = this.cheer > 0 ? 1.35 : 1;
      for (const a of this.model.exhausts) paintExhaust(this.fire, a.getWorldPosition(this.flameAt), "idle", this.time, grow);
      for (const a of this.model.ornaments) {
        const p = a.getWorldPosition(this.flameAt);
        this.fire.flame(p, this.model.ornamentSpectral ? PALETTE.espectro : PALETTE.llama, 0.24 * grow);
        this.fire.flame(p, this.model.ornamentSpectral ? PALETTE.anima : PALETTE.brasa, 0.42 * grow);
      }
    }
    this.fire.end(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
