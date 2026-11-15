import * as THREE from "three";
import { DEFAULT_KART, KART_COLORS } from "@derrape/shared";
import { createKartModel, type KartModel } from "./kartModel";
import { PAL, addNightLights, backdropTexture, glowTexture, toon } from "./look";
import { Sparks } from "./sparks";

/**
 * Vista previa 3D del piloto y el coche elegidos, girando sobre una peana. Usa el mismo renderer que
 * la carrera (iOS limita los contextos WebGL) y se dibuja detrás de la pantalla de selección.
 */
export class GaragePreview {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private model: KartModel | null = null;
  private sparks = new Sparks();
  private cheer = 0;
  private time = 0;
  private last = 0;
  private running = false;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private canvas: HTMLCanvasElement,
  ) {
    this.scene.background = backdropTexture(0x3a2c6a, PAL.noche);
    addNightLights(this.scene);
    // Peana de hueso con calaveritas alrededor y un foco cálido detrás.
    const bone = toon(PAL.hueso);
    const shade = toon(PAL.huesoSombra);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.25, 0.3, 36), bone);
    top.position.y = -0.15;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 0.3, 36), shade);
    base.position.y = -0.45;
    this.scene.add(top, base);
    const skullGeo = new THREE.SphereGeometry(0.2, 10, 8);
    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 5);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1326 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const skull = new THREE.Mesh(skullGeo, bone);
      skull.position.set(Math.sin(a) * 2.45, -0.3, Math.cos(a) * 2.45);
      skull.rotation.y = a;
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(s * 0.08, 0.03, 0.17);
        skull.add(eye);
      }
      this.scene.add(skull);
    }
    const spot = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 13),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: PAL.brasa, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    spot.position.set(-3.4, 2.4, -5.2);
    spot.lookAt(3.4, 2.4, 5.2);
    this.scene.add(spot, this.sparks.group);
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

  /**
   * Retrato de un piloto (primer plano de la cabeza, fondo transparente) como imagen para los
   * botones de selección. Se dibuja una vez con el mismo renderer, en una textura aparte.
   */
  portrait(character: string, size = 144): string {
    const scene = new THREE.Scene();
    addNightLights(scene);
    const model = createKartModel(KART_COLORS[3], character, DEFAULT_KART);
    scene.add(model.root);
    model.root.updateMatrixWorld(true);
    const head = model.body.localToWorld(model.head.clone());
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(head.x + 0.8, head.y + 0.25, head.z + 2.2);
    camera.lookAt(head.x, head.y + 0.06, head.z);

    const target = new THREE.WebGLRenderTarget(size, size);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const r = this.renderer;
    const before = r.getRenderTarget();
    const alpha = r.getClearAlpha();
    r.setRenderTarget(target);
    r.setClearAlpha(0);
    r.clear();
    r.render(scene, camera);
    const pixels = new Uint8Array(size * size * 4);
    r.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    r.setRenderTarget(before);
    r.setClearAlpha(alpha);
    target.dispose();

    // La textura se lee de abajo arriba: se da la vuelta al pasarla al canvas.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d")!;
    const image = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      image.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    }
    g.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
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
      this.model.root.updateMatrixWorld();
      this.sparks.exhaust(this.model, this.model.root.rotation.y, 0);
    }
    this.sparks.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
