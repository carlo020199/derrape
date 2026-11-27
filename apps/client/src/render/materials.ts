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
  turbo1: 0x3ff2c8, // Espectro
  turbo2: 0xffb423, // Llama
  turbo3: 0x9b6bff, // Ánima
  nitro: 0xfff7ea, // Texto
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

let animasGradient: THREE.DataTexture | null = null;
/**
 * Sombra del asfalto de Ánimas: #3A3352 × 0,724 ≈ #2A2440.
 * La rampa general (0,45) lo hunde en el cielo #120F1E.
 */
function animasAsphaltGradient(): THREE.DataTexture {
  if (animasGradient) return animasGradient;
  const data = new Uint8Array([Math.round(0.724 * 255), Math.round(0.86 * 255), 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  animasGradient = markShared(tex);
  return tex;
}

/**
 * Asfalto de Ánimas, todo en el shader y sin triángulos extra:
 * - manchas grandes y suaves en Sombra #2E2547 (×1,5 de luminosidad), con ruido de valor en mundo (4–14 m);
 * - dos rodadas pulidas, algo más claras, a ±30 % del semiancho y rotas a lo largo (ruido sobre la distancia recorrida);
 * - manchas de aceite oscuras, más densas en el eje y en las rodadas;
 * - borde oscuro (hacia Noche #120F1E) en el último metro y medio de cada lado.
 * Sin ruido fino: el grano de alta frecuencia se leía como estática gris. `aRoad` = (metros desde el eje, distancia, semiancho).
 */
function mottle(mat: THREE.MeshToonMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP;\nattribute vec3 aRoad;\nvarying vec3 vRoad;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRoad = aRoad;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vWP;
varying vec3 vRoad;
float mh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mh(i), mh(i + vec2(1.0, 0.0)), f.x), mix(mh(i + vec2(0.0, 1.0)), mh(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float blot = mn(vWP.xz * 0.07) * 0.65 + mn(vWP.xz * 0.19) * 0.35;
float mottle = 1.0 + 0.25 * smoothstep(0.52, 0.6, blot) + 0.25 * smoothstep(0.64, 0.72, blot);
float side = vRoad.x < 0.0 ? 0.0 : 1.0;
float rutD = abs(abs(vRoad.x) - vRoad.z * 0.3);
float rutBreak = smoothstep(0.3, 0.5, mn(vec2(vRoad.y * 0.045, side * 9.0 + 2.0)));
float rut = (1.0 - smoothstep(0.3, 0.7, rutD)) * rutBreak;
mottle *= 1.0 + 0.95 * rut;
float oil = mn(vec2(vRoad.y * 0.16, vRoad.x * 0.55 + 31.0));
float oilZone = max(1.0 - smoothstep(0.0, 1.6, abs(vRoad.x)), rut);
mottle *= 1.0 - 0.55 * smoothstep(0.58, 0.66, oil) * (0.45 + 0.55 * oilZone);
mottle *= mix(0.38, 1.0, smoothstep(0.0, 2.2, vRoad.z - abs(vRoad.x)));
// Gravilla y esquirlas de hueso: puntos redondos sueltos y claros en celdas del suelo, en dos capas para que el plano liso
// se rompa a cualquier distancia: fina (celdas de 33 cm, hasta ~35 m) y gruesa (celdas de 1 m, de 7 a ~55 m).
// Se desvanecen con la distancia para no brillar como estática.
float cam = distance(vWP, cameraPosition);
float edgeW = smoothstep(0.5, 1.8, vRoad.z - abs(vRoad.x));
{
  vec2 cell = vWP.xz * 3.0;
  vec2 ci = floor(cell);
  vec2 off = vec2(mh(ci + 1.7), mh(ci + 5.1)) * 0.5 + 0.25;
  float rad = 0.18 + 0.14 * mh(ci + 9.9);
  float aa = max(fwidth(cell.x), fwidth(cell.y));
  float dot_ = (1.0 - smoothstep(rad - aa, rad + aa, length(fract(cell) - off))) * step(0.55, mh(ci + 7.3));
  mottle += 1.6 * dot_ * (1.0 - smoothstep(24.0, 40.0, cam)) * edgeW * (0.7 + 0.6 * mh(ci + 3.3));
}
{
  vec2 cell = vWP.xz * 1.0 + 40.0;
  vec2 ci = floor(cell);
  vec2 off = vec2(mh(ci + 2.9), mh(ci + 6.1)) * 0.4 + 0.3;
  float rad = 0.14 + 0.1 * mh(ci + 4.4);
  float aa = max(fwidth(cell.x), fwidth(cell.y));
  float dot_ = (1.0 - smoothstep(rad - aa, rad + aa, length(fract(cell) - off))) * step(0.5, mh(ci + 8.8));
  mottle += 1.2 * dot_ * smoothstep(6.0, 12.0, cam) * (1.0 - smoothstep(34.0, 56.0, cam)) * edgeW * (0.7 + 0.6 * mh(ci + 5.5));
}
diffuseColor.rgb *= mottle;`,
      )
      // El emisivo aporta casi toda la luz del asfalto: también lleva las manchas.
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= mottle;");
  };
  return mat;
}

let animasRoad: THREE.MeshToonMaterial | null = null;
/** Asfalto de Ánimas: Ciruela #1E1830 con un emisivo bajo para no fundirse con el cielo. */
export function animasAsphaltMaterial(): THREE.MeshToonMaterial {
  if (!animasRoad) {
    animasRoad = markShared(
      mottle(
        new THREE.MeshToonMaterial({
          color: PALETTE.ciruela,
          emissive: PALETTE.ciruela,
          emissiveIntensity: 1.4,
          gradientMap: animasAsphaltGradient(),
          side: THREE.DoubleSide,
        }),
      ),
    );
  }
  return animasRoad;
}

let animasLine: THREE.MeshToonMaterial | null = null;
/** Misma luz que el asfalto, con el color en los vértices (línea y trazos). */
export function animasAsphaltLineMaterial(): THREE.MeshToonMaterial {
  if (!animasLine) {
    animasLine = markShared(
      new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap: animasAsphaltGradient(),
        side: THREE.DoubleSide,
      }),
    );
  }
  return animasLine;
}

let animasTerrain: THREE.MeshToonMaterial | null = null;
/** Hierba de Ánimas: la banda oscura se queda lila (0,72), no negra. Color por vértice. */
export function animasTerrainMaterial(): THREE.MeshToonMaterial {
  if (!animasTerrain) {
    const data = new Uint8Array([Math.round(0.72 * 255), Math.round(0.87 * 255), 255]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: markShared(tex) });
    // Parches de color: el color por vértice (cada 7,6 m) es demasiado grueso, así que dos capas de ruido de valor
    // en mundo (6 y 2 m) pintan manchas de borde duro: unas hundidas hacia Sombra y otras claras hacia Ánima #9B6BFF.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vPatch;\nvarying float vWY;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvec4 wp = modelMatrix * vec4(transformed, 1.0);\nvPatch = wp.xz;\nvWY = wp.y;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vPatch;
varying float vWY;
float ph(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ph(i), ph(i + vec2(1.0, 0.0)), f.x), mix(ph(i + vec2(0.0, 1.0)), ph(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
float patchDark = smoothstep(0.56, 0.6, pn(vPatch * 0.16 + 3.0) * 0.7 + pn(vPatch * 0.41 + 17.0) * 0.3);
float patchLight = smoothstep(0.64, 0.68, pn(vPatch * 0.31 + 11.0) * 0.6 + pn(vPatch * 0.9 + 5.0) * 0.4);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.6, 0.52, 0.78), patchDark * 0.95);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.61, 0.42, 1.0), patchLight * 0.3);
// Colinas escalonadas: una terraza cada 2,4 m de altura, con el borde de abajo oscuro. Desaparece donde las bandas son más finas que un píxel.
float terr = vWY / 2.4;
float tb = fract(terr);
float tFade = 1.0 - smoothstep(0.12, 0.4, fwidth(terr));
diffuseColor.rgb *= 1.0 - 0.34 * tFade * (1.0 - smoothstep(0.0, 0.16, tb));`,
        );
    };
    animasTerrain = markShared(mat);
  }
  return animasTerrain;
}

let outline: THREE.MeshBasicMaterial | null = null;
/** Contorno Noche, solo en los pilotos. */
export function driverOutlineMaterial(): THREE.MeshBasicMaterial {
  if (!outline) outline = markShared(new THREE.MeshBasicMaterial({ color: NOCHE, side: THREE.BackSide }));
  return outline;
}
