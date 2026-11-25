import * as THREE from "three";
import { DEFAULT_KART, KART_COLORS } from "@derrape/shared";
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
    const rim = new THREE.DirectionalLight(PALETTE.anima, 0.45);
    rim.position.set(-3.5, 2.4, -4);
    this.scene.add(rim);
    // Pedestal de hueso en dos escalones con un foco cálido (Llama) desde arriba.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.3, 32), toonMaterial({ color: PALETTE.sombra }));
    base.position.y = -0.15;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.22, 32), toonMaterial({ color: PALETTE.huesoSombra }));
    top.position.y = 0.11;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.0, 0.05, 6, 32),
      new THREE.MeshBasicMaterial({ color: PALETTE.espectro, toneMapped: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.23;
    // Foco cálido: resplandor aditivo en Llama detrás del piloto (sin luz real).
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const gg = glowCanvas.getContext("2d")!;
    const grd = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,180,35,0.55)");
    grd.addColorStop(0.5, "rgba(255,180,35,0.16)");
    grd.addColorStop(1, "rgba(255,180,35,0)");
    gg.fillStyle = grd;
    gg.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    spot.scale.set(9, 9, 1);
    spot.position.set(-0.6, 2.0, -2.2);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 32),
      new THREE.MeshBasicMaterial({ color: PALETTE.llama, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.235;
    this.scene.add(base, top, ring, spot, pool);
    const warm = new THREE.DirectionalLight(PALETTE.llama, 0.3);
    warm.position.set(-1.5, 6, 2);
    this.scene.add(warm);
    this.camera.position.set(3.2, 2.7, 8.6);
    this.camera.lookAt(0, 0.8, 0);
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

  /**
   * Retrato de un piloto (primer plano de la cabeza, fondo transparente) como imagen para los
   * botones de selección. Se dibuja una vez con el mismo renderer, en una textura aparte.
   */
  portrait(character: string, size = 144): string {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff7ea, PALETTE.ciruela, 0.9));
    const key = new THREE.DirectionalLight(0xfff7ea, 1.25);
    key.position.set(2.2, 3.4, 5);
    scene.add(key);
    const model = createKartModel(KART_COLORS[3], character, DEFAULT_KART);
    scene.add(model.root);
    model.root.updateMatrixWorld(true);
    const head = model.head.getWorldPosition(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(head.x + 0.8, head.y + 0.25, head.z + 2.4);
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
    // En vertical la pantalla es estrecha: la cámara se aleja para que quepan el kart entero, el piloto y el
    // pedestal en el hueco de arriba (la hoja de selección tapa desde ~42 % de alto).
    const wide = w / h > 0.8;
    this.camera.position.set(wide ? 2.6 : 4.1, wide ? 2.7 : 3.4, wide ? 6.6 : 11.6);
    this.camera.lookAt(0, 0.9, 0);
    this.camera.setViewOffset(w, h, 0, wide ? 0 : h * 0.245, w, h);
    this.camera.updateProjectionMatrix();

    this.fire.begin();
    if (this.model) {
      // Tres cuartos de frente, sin dar la espalda: la cara es lo que se elige.
      const yaw = 0.62 + Math.sin(this.time * 0.6) * 0.12;
      this.model.root.rotation.y = yaw;
      this.cheer = Math.max(0, this.cheer - dt);
      this.model.animate(yaw, dt, false, this.time);
      this.model.setMood(this.cheer > 0 ? "celebrate" : "idle", this.time);
      for (const a of this.model.lamps) this.fire.flame(a.getWorldPosition(new THREE.Vector3()), PALETTE.llama, 0.55);
      const dir = this.flameAt;
      const local = new THREE.Vector3(0, 0.28, -1).normalize();
      for (const a of this.model.exhausts) {
        a.updateWorldMatrix(true, false);
        const at = a.getWorldPosition(new THREE.Vector3());
        dir.copy(local).transformDirection(a.matrixWorld);
        paintExhaust(this.fire, at, dir, this.model.flameLength * 0.35, "idle", this.time, dt);
      }
      for (const a of this.model.ornaments) paintHair(this.fire, a.getWorldPosition(new THREE.Vector3()), this.model.ornamentSpectral, this.time, 1.2);
    }
    this.fire.end(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
