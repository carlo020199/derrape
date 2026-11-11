import * as THREE from "three";

/** Noche: contornos, texto sobre botones claros y sombras. */
export const NOCHE = 0x120f1e;

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
/** Material compartido de coches, pilotos y piezas con color por vértice. */
export function sharedVertexToon(): THREE.MeshToonMaterial {
  if (!vertexToon) vertexToon = markShared(toonMaterial({ vertexColors: true }));
  return vertexToon;
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
