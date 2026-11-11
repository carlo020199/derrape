import * as THREE from "three";
import { KART_COLORS } from "@derrape/shared";
import { createKartModel, type KartModel } from "./kartModel";
import { Fire, paintExhaust, paintHair } from "./flames";
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
    this.scene.background = new THREE.Color(PALETTE.ciruela);
    this.scene.add(createGradientSky(0x120f1e, 0x2e2547, 40));
    this.scene.add(new THREE.HemisphereLight(0xfff7ea, PALETTE.ciruela, 0.55));
    const key = new THREE.DirectionalLight(0xfff7ea, 1.25);
    key.position.set(2.2, 3.4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(PALETTE.anima, 0.85);
    rim.position.set(-3.5, 2.4, -4);
    this.scene.add(rim);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.35, 0.28, 28),
      toonMaterial({ color: PALETTE.ciruela }),
    );
    pedestal.position.y = -0.14;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.07, 8, 28),
      new THREE.MeshBasicMaterial({ color: PALETTE.anima, toneMapped: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(pedestal, ring);
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
    // La hoja tapa desde ~34 % de alto. La cara entera (ojos, nariz y sonrisa) cabe en ese hueco.
    this.camera.position.set(1.05, 1.28, 4.35);
    this.camera.lookAt(0, 1.12, 0.1);
    this.camera.setViewOffset(w, h, 0, h * 0.06, w, h);
    this.camera.updateProjectionMatrix();

    this.fire.begin();
    if (this.model) {
      // Tres cuartos de frente, sin dar la espalda: la cara es lo que se elige.
      const yaw = 0.62 + Math.sin(this.time * 0.6) * 0.12;
      this.model.root.rotation.y = yaw;
      this.cheer = Math.max(0, this.cheer - dt);
      this.model.setMood(this.cheer > 0 ? "celebrate" : "idle", this.time);
      const dir = this.flameAt;
      const local = new THREE.Vector3(0, 0.42, -1).normalize();
      for (const a of this.model.exhausts) {
        a.updateWorldMatrix(true, false);
        const at = a.getWorldPosition(new THREE.Vector3());
        dir.copy(local).transformDirection(a.matrixWorld);
        paintExhaust(this.fire, at, dir, this.model.flameLength * 0.55, "idle", this.time, dt);
      }
      for (const a of this.model.ornaments) paintHair(this.fire, a.getWorldPosition(new THREE.Vector3()), this.model.ornamentSpectral, this.time, 1.2);
    }
    this.fire.end(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
