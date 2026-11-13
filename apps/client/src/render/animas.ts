import * as THREE from "three";
import { closestPoint, pointAt, RAMP, surfaceNormal, surfaceY, type Track, type TrackDef } from "@derrape/shared";
import { PALETTE, boneToonMaterial, sharedBoneToon, toonMaterial } from "./materials";

// Kit de Laguna de las Ánimas. Paleta del proyecto, formas redondas y toon.
// Los faroles son una sola malla instanciada: el brillo es el color, sin luces reales.

const HUESO = PALETTE.hueso;
const BRASA = PALETTE.brasa;
const LLAMA = PALETTE.llama;
const ANIMA = PALETTE.anima;
const ESPECTRO = PALETTE.espectro;
const CIRUELA = PALETTE.ciruela;

function paint(geo: THREE.BufferGeometry, color: number) {
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function bake(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color: number) {
  const src = geo.clone();
  // Normales suaves mientras la malla aún comparte vértices. Si se calculan
  // después de separar los triángulos, cada cara queda plana y el hueso se ve gris.
  if (!src.getAttribute("normal")) src.computeVertexNormals();
  const g = src.index ? src.toNonIndexed() : src;
  g.applyMatrix4(matrix);
  return paint(g, color);
}

function merge(parts: THREE.BufferGeometry[]) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of flat) count += g.getAttribute("position").count;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of flat) {
    const p = g.getAttribute("position");
    const c = g.getAttribute("color");
    const nrm = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      pos[(o + i) * 3] = p.getX(i);
      pos[(o + i) * 3 + 1] = p.getY(i);
      pos[(o + i) * 3 + 2] = p.getZ(i);
      if (c) {
        col[(o + i) * 3] = c.getX(i);
        col[(o + i) * 3 + 1] = c.getY(i);
        col[(o + i) * 3 + 2] = c.getZ(i);
      }
      if (nrm) {
        nor[(o + i) * 3] = nrm.getX(i);
        nor[(o + i) * 3 + 1] = nrm.getY(i);
        nor[(o + i) * 3 + 2] = nrm.getZ(i);
      }
    }
    o += p.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return geo;
}

const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );

/** Campanario: una sola malla, hueso con tejado ciruela y campana llama. */
export function campanarioGeometry(): THREE.BufferGeometry {
  const body = new THREE.CapsuleGeometry(1.7, 11, 3, 18);
  const roof = new THREE.ConeGeometry(2.5, 4.2, 20);
  const bell = new THREE.SphereGeometry(0.7, 14, 10);
  const halo = new THREE.TorusGeometry(0.85, 0.1, 8, 16);
  return merge([
    bake(body, M(0, 7.2), HUESO),
    bake(roof, M(0, 14.6), CIRUELA),
    bake(bell, M(0, 8.2), LLAMA),
    bake(halo, M(0, 8.2, 0, Math.PI / 2), HUESO),
  ]);
}

export function triangleCount(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  return pos ? pos.count / 3 : 0;
}

/**
 * Lomo apoyado en la calzada: bajo por detrás, alto en el labio (z = 0).
 * No es un disco flotante: la base está en y = 0 y el ancho cabe en la pista.
 */
function humpGeometry(len: number, lip: number, halfWidth: number, yScale = 1) {
  const radius = Math.max(0.34, lip * 0.62);
  const straight = Math.max(0.5, len * 0.62);
  const g = new THREE.CapsuleGeometry(radius, straight, 5, 14);
  g.rotateX(Math.PI / 2);
  g.translate(0, radius * 0.72, -len * 0.28);
  g.scale(halfWidth / radius, yScale, 1);
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const flat = g.index ? g.toNonIndexed() : g;
  const pos = flat.getAttribute("position");
  const bone = new THREE.Color(HUESO);
  const shade = new THREE.Color(PALETTE.huesoSombra);
  const brasa = new THREE.Color(BRASA);
  const colors = new Float32Array(pos.count * 3);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    zMin = Math.min(zMin, pos.getZ(i));
    zMax = Math.max(zMax, pos.getZ(i));
  }
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getZ(i) - zMin) / (zMax - zMin || 1);
    // Tres franjas anchas en la cara de llegada, no solo en el labio.
    const stripe = Math.floor(u * 8);
    const band = stripe % 2 === 1 && stripe <= 5 && pos.getY(i) > radius * 0.25;
    const c = band ? brasa : pos.getY(i) > radius * 0.7 ? bone : shade;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

/**
 * Mandíbula del salto L y cráneo abierto.
 * El paladar queda al menos a 4,42 + 6 m sobre la calzada: el kart no lo roza.
 */
export function jawLocalGeometry(): THREE.BufferGeometry {
  const lip = RAMP.L.lip;
  const len = RAMP.L.len;
  const jaw = humpGeometry(len, lip, 6.0);
  const parts: THREE.BufferGeometry[] = [jaw];
  const tooth = new THREE.SphereGeometry(0.46, 12, 10);
  for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) {
    parts.push(bake(tooth, M(x, lip * 0.72, -0.15, 0, 0, 0, 0.8, 1.25, 0.7), HUESO));
  }
  // Mofletes pegados a la mandíbula. El arco sale de ellos y cruza por encima de la pista.
  // Columnas de hueso: salen de la mandíbula y se funden con los pies del arco.
  const leg = new THREE.CapsuleGeometry(1.55, 6.2, 5, 14);
  parts.push(bake(leg, M(-6.4, 4.4, -0.15), HUESO));
  parts.push(bake(leg, M(6.4, 4.4, -0.15), HUESO));
  const archR = 7.9;
  const tube = 1.45;
  const footY = 5.05;
  const arch = new THREE.TorusGeometry(archR, tube, 12, 28, Math.PI);
  // Los pies del arco (y local 0) quedan en los mofletes. El intradós del centro supera 10,4 m.
  parts.push(bake(arch, M(0, footY, -0.15), HUESO));
  return merge(parts);
}

/** Vértices del cráneo que caen sobre la trayectoria (no los mofletes). */
export function flightCorridorMinY(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  let min = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(x) > 3.2 || z < -1 || z > 20 || y < 4) continue;
    min = Math.min(min, y);
  }
  return min;
}

function placeOnTrack(mesh: THREE.Object3D, x: number, y: number, z: number, heading: number) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = heading;
}

function clear(track: Track, x: number, z: number, margin: number) {
  const c = closestPoint(track, x, z);
  return Math.abs(c.lateral) > c.width / 2 + track.verge + margin;
}

function lanternGeometry() {
  const ball = paint(new THREE.SphereGeometry(0.32, 8, 6), LLAMA);
  const ring = bake(new THREE.TorusGeometry(0.46, 0.07, 6, 10), M(), HUESO);
  return merge([ball, ring]);
}

function lanternMaterial() {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader =
      "uniform float uTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
#ifdef USE_INSTANCING
         transformed.y += sin(uTime * 1.7 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21) * 0.3;
#endif`,
      );
    mat.userData.shader = shader;
  };
  return mat;
}

function stars() {
  const n = 48;
  const pos = new Float32Array(n * 3);
  let s = 1111;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < n; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = rnd() * 0.7;
    const r = 180;
    pos[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
    pos[i * 3 + 1] = 40 + Math.sin(phi) * r;
    pos[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: HUESO, size: 1.4, sizeAttenuation: false }));
  pts.name = "estrellas";
  return pts;
}

/** Brasa de fondo y chevrones Llama. El plano entero va al 55 % de opacidad. */
function chevronTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#FF6A1F";
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "rgba(255, 180, 35, 0.7)";
  for (let i = 0; i < 3; i++) {
    const y = 6 + i * 20;
    g.beginPath();
    g.moveTo(0, y + 8);
    g.lineTo(64, y);
    g.lineTo(128, y + 8);
    g.lineTo(128, y + 14);
    g.lineTo(64, y + 6);
    g.lineTo(0, y + 14);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Paneles de turbo pegados a la calzada. Antes eran cajas horizontales de casi
 * todo el ancho: en un peralte asomaban como losas amarillas.
 */
function boostMarks(track: Track) {
  // 2 m a lo ancho de la pista y 3 m a lo largo. Un solo panel por salida, en la trazada.
  const geo = new THREE.PlaneGeometry(2, 3);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: chevronTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const spots: THREE.Matrix4[] = [];
  const nrm = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  for (const z of track.zones) {
    if (z.type !== "boostPad") continue;
    const end = z.to < z.from ? z.to + track.length : z.to;
    const d = (z.from + (end - z.from) / 2) % track.length;
    const p = pointAt(track, d);
    const c = closestPoint(track, p.x, p.z);
    const n = surfaceNormal(track, c);
    nrm.set(n.x, n.y, n.z).normalize();
    fwd.set(Math.sin(p.heading), 0, Math.cos(p.heading));
    fwd.addScaledVector(nrm, -fwd.dot(nrm));
    if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, 1);
    fwd.normalize();
    right.crossVectors(fwd, nrm).normalize();
    basis.makeBasis(right, nrm, fwd);
    basis.setPosition(p.x + nrm.x * 0.02, surfaceY(c) + nrm.y * 0.02, p.z + nrm.z * 0.02);
    spots.push(basis.clone());
  }
  if (spots.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  spots.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.name = "paneles-turbo";
  return mesh;
}

export function decorateAnimas(scene: THREE.Object3D, track: Track, def: TrackDef) {
  const moon = scene.getObjectByName("luna");
  if (moon) moon.scale.setScalar(1.55);
  scene.getObjectByName("cielo")?.add(stars());

  const bone = sharedBoneToon();

  // Campanario a un lado de la recta, a unos 50 m de la parrilla: silueta entera, no un muro en la cámara.
  const spot = pointAt(track, 42, 11);
  const road = pointAt(track, 42, 0);
  const tower = new THREE.Mesh(campanarioGeometry(), bone);
  tower.position.set(spot.x, spot.y, spot.z);
  tower.rotation.y = Math.atan2(road.x - spot.x, road.z - spot.z);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), new THREE.MeshBasicMaterial({ color: LLAMA }));
  bell.position.set(0, 9.2, 1.85);
  tower.add(bell);
  const bellRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 8, 16), boneToonMaterial());
  bellRing.position.copy(bell.position);
  bellRing.rotation.x = Math.PI / 2;
  tower.add(bellRing);
  tower.name = "campanario";
  scene.add(tower);

  // Arco-calavera en la salida, en vez del arco genérico.
  const start = pointAt(track, 0);
  const span = 4.6;
  const arch = merge([
    bake(new THREE.CapsuleGeometry(0.28, 2.6, 3, 10), M(-span, 1.7, 0), HUESO),
    bake(new THREE.CapsuleGeometry(0.28, 2.6, 3, 10), M(span, 1.7, 0), HUESO),
    bake(new THREE.CapsuleGeometry(0.32, span * 2, 3, 12), M(0, 3.35, 0, 0, 0, Math.PI / 2), HUESO),
    bake(new THREE.SphereGeometry(0.7, 14, 12), M(0, 4.15, 0.15), HUESO),
  ]);
  const archMesh = new THREE.Mesh(arch, bone);
  placeOnTrack(archMesh, start.x, start.y, start.z, start.heading);
  scene.add(archMesh);

  // Salto L: mandíbula. Los ojos van aparte (un lit sin luz, color ánima).
  const big = track.zones.find((z) => z.type === "ramp" && z.size === "L");
  if (big) {
    const lip = pointAt(track, big.to);
    const jaw = new THREE.Mesh(jawLocalGeometry(), bone);
    placeOnTrack(jaw, lip.x, lip.y, lip.z, lip.heading);
    jaw.name = "mandibula";
    const brasaMat = new THREE.MeshBasicMaterial({ color: BRASA });
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.22, 0.42), brasaMat);
      band.position.set(0, 0.85 + i * 0.48, -0.35);
      jaw.add(band);
    }
    scene.add(jaw);
    const eyeGeo = new THREE.SphereGeometry(0.78, 12, 10);
    const eyes = new THREE.InstancedMesh(eyeGeo, new THREE.MeshBasicMaterial({ color: ANIMA }), 2);
    const base = new THREE.Matrix4().makeRotationY(lip.heading);
    base.setPosition(lip.x, lip.y, lip.z);
    // Cuencas en la cara del cráneo, mirando a quien se acerca.
    for (const [i, x] of [-1.35, 1.35].entries()) {
      const local = M(x, 11.4, -1.15);
      eyes.setMatrixAt(i, base.clone().multiply(local));
    }
    eyes.frustumCulled = false;
    eyes.name = "ojos-calavera";
    scene.add(eyes);
  }

  // Rampas S y M: lomos de hueso.
  const humps: THREE.BufferGeometry[] = [];
  const stripes: THREE.BufferGeometry[] = [];
  for (const z of track.zones) {
    if (z.type !== "ramp" || !z.size || z.size === "L") continue;
    const spec = RAMP[z.size];
    const lip = pointAt(track, z.to);
    const g = humpGeometry(spec.len, spec.lip, Math.min(2.15, lip.width * 0.16), 1.45);
    g.applyMatrix4(M(lip.x, lip.y, lip.z, 0, lip.heading));
    humps.push(g);
    if (z.size === "M") {
      const box = new THREE.BoxGeometry(4.2, 0.38, 0.32);
      const world = new THREE.Matrix4().makeRotationY(lip.heading).setPosition(lip.x, lip.y, lip.z);
      for (let i = 0; i < 3; i++) {
        stripes.push(bake(box, world.clone().multiply(M(0, 1.05 + i * 0.48, -5.35 + i * 0.42)), BRASA));
      }
      box.dispose();
    }
  }
  if (humps.length) scene.add(new THREE.Mesh(merge(humps), bone));
  if (stripes.length) {
    const paint = new THREE.Mesh(merge(stripes), new THREE.MeshBasicMaterial({ color: BRASA }));
    paint.name = "franjas-rampa";
    scene.add(paint);
  }

  // Laguna bajo el salto, siempre por debajo del asfalto más bajo de la zona.
  // Se dibuja antes que los karts y con depthTest, para no teñir la escena.
  if (big) {
    let low = Infinity;
    for (let d = big.from - 6; d <= big.to + 50; d += 2) {
      const p = pointAt(track, d);
      low = Math.min(low, p.y);
      low = Math.min(low, surfaceY({ y: p.y, lateral: p.width / 2, bank: p.bank }));
      low = Math.min(low, surfaceY({ y: p.y, lateral: -p.width / 2, bank: p.bank }));
    }
    const waterY = low - 1.8;
    const mid = pointAt(track, big.to + 16);
    const waterMat = new THREE.MeshBasicMaterial({
      color: ESPECTRO,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
      depthWrite: true,
      side: THREE.FrontSide,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(22, 28), waterMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(mid.x, waterY, mid.z);
    disc.renderOrder = -2;
    disc.name = "laguna";
    scene.add(disc);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(20.2, 22, 28),
      new THREE.MeshBasicMaterial({ color: ESPECTRO, depthTest: true, depthWrite: true, side: THREE.FrontSide }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(mid.x, waterY + 0.04, mid.z);
    rim.renderOrder = -2;
    rim.name = "laguna-borde";
    scene.add(rim);
  }

  // Faroles flotantes, una sola malla.
  const lanterns = new THREE.InstancedMesh(lanternGeometry(), lanternMaterial(), 40);
  let n = 0;
  const pts = track.points;
  for (let i = 0; i < pts.length && n < 40; i += 16) {
    const p = pts[i]!;
    const side = i % 32 === 0 ? 1 : -1;
    const off = p.w / 2 + track.verge + 2.2;
    const c = closestPoint(track, p.x, p.z);
    const left = pointAt(track, c.distance, off * side);
    if (!clear(track, left.x, left.z, 0.4)) continue;
    lanterns.setMatrixAt(n++, M(left.x, p.y + 3.1, left.z));
  }
  lanterns.count = n;
  lanterns.frustumCulled = false;
  lanterns.userData.animasLanterns = true;
  lanterns.onBeforeRender = () => {
    const shader = lanterns.material.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
    if (shader) shader.uniforms.uTime.value = performance.now() / 1000;
  };
  scene.add(lanterns);

  // Pinos de hueso y lápidas en el Pinar, linternas ya van en la subida con el mismo lote.
  const trunks = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 1.4, 2, 6), boneToonMaterial(), 16);
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), toonMaterial({ color: ANIMA }), 16);
  const tombs = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.35, 0.7, 2, 6), boneToonMaterial(), 12);
  let trees = 0;
  let graves = 0;
  for (let i = 0; i < pts.length && (trees < 16 || graves < 12); i += 10) {
    const dist = track.lengths[i]!;
    const f = dist / track.length;
    if (f < 0.54 || f > 0.66) continue;
    const p = pts[i]!;
    const c = closestPoint(track, p.x, p.z);
    const spot = pointAt(track, c.distance, (trees % 2 === 0 ? 1 : -1) * (p.w / 2 + track.verge + 3));
    if (!clear(track, spot.x, spot.z, 0.3)) continue;
    if (trees < 16) {
      trunks.setMatrixAt(trees, M(spot.x, p.y + 1, spot.z));
      crowns.setMatrixAt(trees, M(spot.x, p.y + 2.5, spot.z, 0, 0, 0, 1.1, 0.8, 1.1));
      trees++;
    } else if (graves < 12) {
      tombs.setMatrixAt(graves++, M(spot.x, p.y + 0.7, spot.z));
    }
  }
  trunks.count = trees;
  crowns.count = trees;
  tombs.count = graves;
  trunks.frustumCulled = false;
  crowns.frustumCulled = false;
  tombs.frustumCulled = false;
  scene.add(trunks, crowns, tombs);

  const pumpkinMark = def.landmarks?.find((m) => m.kind === "calabaza");
  if (pumpkinMark && clear(track, pumpkinMark.x, pumpkinMark.z, 0)) {
    const y = closestPoint(track, pumpkinMark.x, pumpkinMark.z).y;
    const pumpkin = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10), toonMaterial({ color: BRASA }));
    pumpkin.position.set(pumpkinMark.x, y + 1.6, pumpkinMark.z);
    scene.add(pumpkin);
  }

  const pads = boostMarks(track);
  if (pads) {
    pads.frustumCulled = false;
    scene.add(pads);
  }
}
