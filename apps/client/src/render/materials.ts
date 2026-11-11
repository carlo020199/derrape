import * as THREE from "three";

/** Noche: contornos, texto sobre botones claros y sombras. */
export const NOCHE = 0x120f1e;

/** Paleta de la propuesta (hex exactos). El fuego y los pilotos la comparten. */
export const PALETTE = {
  noche: NOCHE,
  ciruela: 0x1e1830,
  sombra: 0x2e2547,
  niebla: 0x5b4e7a,
  brasa: 0xff6a1f,
  llama: 0xffb423,
  ascua: 0xd9362b,
  espectro: 0x3ff2c8,
  anima: 0x9b6bff,
  animaProfunda: 0x6b3fd6,
  hueso: 0xf3e7d3,
  huesoSombra: 0xc8b597,
  marfil: 0x8c7b66,
  texto: 0xfff7ea,
  turbo1: 0x5cc8ff,
  turbo2: 0xff9a1f,
  turbo3: 0xb57bff,
  nitro: 0xfff2c2,
} as const;

export function markShared<T extends { userData: { shared?: boolean } }>(resource: T): T {
  resource.userData.shared = true;
  return resource;
}

export function isShared(resource: { userData?: { shared?: boolean } } | null | undefined): boolean {
  return resource?.userData?.shared === true;
}

let gradient: THREE.DataTexture | null = null;

/**
 * Rampas de luz del toon: 0,45 · 0,75 · 1,0. El filtro nearest deja tres bandas duras.
 * Una sola textura para todo el juego (no suma llamadas de dibujo).
 */
export function toonGradientMap(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([Math.round(0.45 * 255), Math.round(0.75 * 255), 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  gradient = markShared(tex);
  return tex;
}

export function toonMaterial(params: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ ...params, gradientMap: toonGradientMap() });
}

let vertexToon: THREE.MeshToonMaterial | null = null;
/** Material compartido de coches y piezas con color por vértice. */
export function sharedVertexToon(): THREE.MeshToonMaterial {
  if (!vertexToon) vertexToon = markShared(toonMaterial({ vertexColors: true }));
  return vertexToon;
}

let boneGradient: THREE.DataTexture | null = null;
/**
 * Sombra del hueso cerca de #C8B597 sobre #F3E7D3.
 * La rampa general (0,45) apaga el cráneo y lo deja de color carne.
 */
function boneGradientMap(): THREE.DataTexture {
  if (boneGradient) return boneGradient;
  const data = new Uint8Array([Math.round(0.8 * 255), Math.round(0.91 * 255), 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  boneGradient = markShared(tex);
  return tex;
}

/** Toon de piezas de hueso: la sombra se queda en #C8B597, no en gris. */
export function boneToonMaterial(): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: PALETTE.hueso, gradientMap: boneGradientMap() });
}

let boneToon: THREE.MeshToonMaterial | null = null;
/** Toon de los pilotos: el hueso se queda hueso en la banda oscura. */
export function sharedBoneToon(): THREE.MeshToonMaterial {
  if (!boneToon) boneToon = markShared(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: boneGradientMap() }));
  return boneToon;
}

let vertexToonDouble: THREE.MeshToonMaterial | null = null;
/** La pista se ve por las dos caras (talud y muros). */
export function sharedVertexToonDouble(): THREE.MeshToonMaterial {
  if (!vertexToonDouble) vertexToonDouble = markShared(toonMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  return vertexToonDouble;
}

let outline: THREE.MeshBasicMaterial | null = null;
/** Contorno Noche, solo en los pilotos. */
export function driverOutlineMaterial(): THREE.MeshBasicMaterial {
  if (!outline) outline = markShared(new THREE.MeshBasicMaterial({ color: NOCHE, side: THREE.BackSide }));
  return outline;
}
