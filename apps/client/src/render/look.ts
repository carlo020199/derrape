import * as THREE from "three";

// El "look" común: paleta, sombreado toon, contorno, cielo nocturno y brillos aditivos.
// Todo generado por código (sin assets externos) y pensado para móvil: sin post-procesado.

export const PAL = {
  noche: 0x120f1e,
  ciruela: 0x1e1830,
  sombra: 0x2e2547,
  niebla: 0x5b4e7a,
  brasa: 0xff6a1f,
  llama: 0xffb423,
  ascua: 0xd9362b,
  espectro: 0x3ff2c8,
  anima: 0x9b6bff,
  animaProf: 0x6b3fd6,
  hueso: 0xf3e7d3,
  huesoSombra: 0xc8b597,
  texto: 0xfff7ea,
  peligro: 0xff4d6d,
} as const;

let gradient: THREE.DataTexture | null = null;
/** Rampa de 3 tonos para el sombreado toon. */
function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function toon(color = 0xffffff, vertexColors = false) {
  return new THREE.MeshToonMaterial({ color, vertexColors, gradientMap: toonGradient() });
}

/** Contorno: la misma malla, vista por dentro y un poco hinchada (solo se usa en los pilotos). */
export function outlineMaterial(width = 0.03, color: number = PAL.noche) {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`,
    );
  };
  return mat;
}

let glow: THREE.CanvasTexture | null = null;
/** Mancha redonda suave: partículas de fuego, halos de farol, sombra bajo el kart. */
export function glowTexture() {
  if (!glow) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glow = new THREE.CanvasTexture(c);
  }
  return glow;
}

const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Degradado vertical: arriba → horizonte → resplandor bajo. */
function skyCanvas(top: number, horizon: number, glowColor: number) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, css(top));
  grad.addColorStop(0.3, css(top));
  grad.addColorStop(0.47, css(horizon));
  grad.addColorStop(0.5, css(glowColor));
  grad.addColorStop(0.53, css(horizon));
  grad.addColorStop(1, css(horizon));
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Fondo plano para escenas sin horizonte (la peana de selección). */
export function backdropTexture(top: number, bottom: number) {
  return skyCanvas(top, bottom, bottom);
}

/**
 * Cúpula del cielo con luna. Hay que centrarla en la cámara cada frame
 * (`sky.position.copy(camera.position)`) para que nunca se llegue a ella.
 */
export function createSky(top: number, horizon: number, glowColor: number): THREE.Group {
  const group = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(420, 24, 12),
    new THREE.MeshBasicMaterial({ map: skyCanvas(top, horizon, glowColor), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  dome.renderOrder = -2;
  group.add(dome);

  const dir = new THREE.Vector3(-0.45, 0.42, -0.79).normalize();
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 190),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: PAL.anima, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }),
  );
  const moon = new THREE.Mesh(new THREE.CircleGeometry(26, 28), new THREE.MeshBasicMaterial({ color: PAL.hueso, fog: false, depthWrite: false }));
  const crater = new THREE.MeshBasicMaterial({ color: PAL.huesoSombra, fog: false, depthWrite: false });
  for (const [x, y, r] of [[-8, 6, 5], [7, -4, 6.5], [4, 12, 3], [-10, -11, 3.5]] as const) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), crater);
    m.position.set(x, y, 0.5);
    moon.add(m);
  }
  halo.position.copy(dir).multiplyScalar(402);
  moon.position.copy(dir).multiplyScalar(400);
  halo.lookAt(0, 0, 0);
  moon.lookAt(0, 0, 0);
  halo.renderOrder = moon.renderOrder = -1;
  group.add(halo, moon);

  // Estrellas: puntos fijos en la media cúpula de arriba.
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const stars: number[] = [];
  for (let i = 0; i < 220; i++) {
    const a = rand() * Math.PI * 2;
    const h = 0.12 + rand() * 0.85;
    const r = Math.sqrt(1 - h * h);
    stars.push(Math.cos(a) * r * 405, h * 405, Math.sin(a) * r * 405);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
  const starPoints = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: PAL.texto, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false, depthWrite: false }),
  );
  starPoints.renderOrder = -1;
  group.add(starPoints);
  group.traverse((o) => (o.frustumCulled = false));
  return group;
}

/** Luz de noche: ambiente violeta que deja leer los colores y una "luna" fría que marca el toon. */
export function addNightLights(scene: THREE.Object3D) {
  scene.add(new THREE.HemisphereLight(0xcfc0ff, 0x3a2a60, 1.35));
  const moon = new THREE.DirectionalLight(0xe6e9ff, 1.25);
  moon.position.set(-30, 55, -25);
  scene.add(moon);
  const ember = new THREE.DirectionalLight(PAL.brasa, 0.35);
  ember.position.set(20, 8, 30);
  scene.add(ember);
}

/** Muchos halos de luz (faroles, ventanas) en una sola llamada de dibujo. */
export class GlowPoints {
  private pos: number[] = [];
  private col: number[] = [];
  private c = new THREE.Color();
  constructor(private readonly size: number) {}
  add(x: number, y: number, z: number, color: number, strength = 1) {
    this.pos.push(x, y, z);
    this.c.setHex(color).multiplyScalar(strength);
    this.col.push(this.c.r, this.c.g, this.c.b);
  }
  build(parent: THREE.Object3D) {
    if (this.pos.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: this.size,
        map: glowTexture(),
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    parent.add(points);
  }
}
