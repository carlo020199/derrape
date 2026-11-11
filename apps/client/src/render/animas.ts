import * as THREE from "three";
import { closestPoint, pointAt, RAMP, type Track, type TrackDef } from "@derrape/shared";
import { PALETTE, sharedVertexToon, toonMaterial } from "./materials";

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
  const g = geo.clone();
  g.applyMatrix4(matrix);
  return paint(g, color);
}

function merge(parts: THREE.BufferGeometry[]) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of flat) count += g.getAttribute("position").count;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const g of flat) {
    const p = g.getAttribute("position");
    const c = g.getAttribute("color");
    for (let i = 0; i < p.count; i++) {
      pos[(o + i) * 3] = p.getX(i);
      pos[(o + i) * 3 + 1] = p.getY(i);
      pos[(o + i) * 3 + 2] = p.getZ(i);
      if (c) {
        col[(o + i) * 3] = c.getX(i);
        col[(o + i) * 3 + 1] = c.getY(i);
        col[(o + i) * 3 + 2] = c.getZ(i);
      }
    }
    o += p.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
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

/** Lomo redondeado. El labio (z alta) lleva bandas brasa. */
function humpGeometry(len: number, lip: number, halfWidth: number) {
  const g = new THREE.SphereGeometry(1, 16, 12);
  g.scale(halfWidth, lip, len / 2);
  g.translate(0, lip * 0.15, -len / 2);
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const bone = new THREE.Color(HUESO);
  const brasa = new THREE.Color(BRASA);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    zMin = Math.min(zMin, pos.getZ(i));
    zMax = Math.max(zMax, pos.getZ(i));
  }
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getZ(i) - zMin) / (zMax - zMin || 1);
    const band = u > 0.55 && Math.floor(u * 10) % 2 === 0;
    const c = band ? brasa : bone;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/**
 * Mandíbula del salto L y cráneo abierto.
 * El paladar queda al menos a 4,42 + 6 m sobre la calzada: el kart no lo roza.
 */
export function jawLocalGeometry(): THREE.BufferGeometry {
  const lip = RAMP.L.lip;
  const len = RAMP.L.len;
  const jaw = humpGeometry(len, lip, 6.2);
  const tooth = new THREE.SphereGeometry(0.42, 8, 6);
  const parts: THREE.BufferGeometry[] = [jaw];
  for (const x of [-5.2, -3.4, -2.0, 2.0, 3.4, 5.2]) {
    parts.push(bake(tooth, M(x, lip + 0.2, -0.15), HUESO));
  }
  const post = new THREE.CapsuleGeometry(0.5, 6.2, 2, 8);
  parts.push(bake(post, M(-8.4, 4.4, 2), HUESO));
  parts.push(bake(post, M(8.4, 4.4, 2), HUESO));
  const cheek = new THREE.SphereGeometry(1.35, 10, 8);
  parts.push(bake(cheek, M(-7.4, 6.8, 2.4), HUESO));
  parts.push(bake(cheek, M(7.4, 6.8, 2.4), HUESO));
  // Paladar por encima del vuelo. El ápice de diseño es 4,42 m; debajo del arco quedan 6 m.
  const palate = new THREE.CapsuleGeometry(0.7, 15, 2, 10);
  parts.push(bake(palate, M(0, 4.42 + 6 + 0.7, 8, 0, 0, Math.PI / 2), HUESO));
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

function boostMarks(track: Track) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = toonMaterial({ color: LLAMA });
  const spots: THREE.Matrix4[] = [];
  for (const z of track.zones) {
    if (z.type !== "boostPad") continue;
    const end = z.to < z.from ? z.to + track.length : z.to;
    for (let d = z.from; d < end; d += 3) {
      const p = pointAt(track, d % track.length);
      spots.push(M(p.x, p.y + 0.03, p.z, 0, p.heading, 0, p.width * 0.45, 0.05, 2));
    }
  }
  if (spots.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  spots.forEach((m, i) => mesh.setMatrixAt(i, m));
  return mesh;
}

export function decorateAnimas(scene: THREE.Object3D, track: Track, def: TrackDef) {
  const moon = scene.getObjectByName("luna");
  if (moon) moon.scale.setScalar(1.55);
  scene.getObjectByName("cielo")?.add(stars());

  const toon = sharedVertexToon();

  // Campanario junto a la meta, por delante de la parrilla para que la cámara lo vea.
  // El hito del diseño cae detrás de la cámara de persecución.
  // Un poco por delante de la meta y apenas fuera del arcén: la cámara de la parrilla lo tiene en cuadro.
  const spot = pointAt(track, 6, 7);
  const tower = new THREE.Mesh(campanarioGeometry(), toon);
  tower.scale.setScalar(1.55);
  tower.position.set(spot.x, spot.y, spot.z);
  tower.name = "campanario";
  scene.add(tower);

  // Arco-calavera en la salida, en vez del arco genérico.
  const start = pointAt(track, 0);
  const arch = merge([
    bake(new THREE.CapsuleGeometry(0.32, 5, 2, 8), M(-(start.width / 2 + 1), 3, 0), HUESO),
    bake(new THREE.CapsuleGeometry(0.32, 5, 2, 8), M(start.width / 2 + 1, 3, 0), HUESO),
    bake(new THREE.CapsuleGeometry(0.4, start.width, 2, 8), M(0, 6.1, 0, 0, 0, Math.PI / 2), HUESO),
    bake(new THREE.SphereGeometry(1.1, 12, 10), M(0, 7.3, 0.2), HUESO),
  ]);
  const archMesh = new THREE.Mesh(arch, toon);
  placeOnTrack(archMesh, start.x, start.y, start.z, start.heading);
  scene.add(archMesh);

  // Salto L: mandíbula. Los ojos van aparte (un lit sin luz, color ánima).
  const big = track.zones.find((z) => z.type === "ramp" && z.size === "L");
  if (big) {
    const lip = pointAt(track, big.to);
    const jaw = new THREE.Mesh(jawLocalGeometry(), toon);
    placeOnTrack(jaw, lip.x, lip.y, lip.z, lip.heading);
    jaw.name = "mandibula";
    scene.add(jaw);
    const eyeGeo = new THREE.SphereGeometry(0.55, 10, 8);
    const eyes = new THREE.InstancedMesh(eyeGeo, new THREE.MeshBasicMaterial({ color: ANIMA }), 2);
    const base = new THREE.Matrix4().makeRotationY(lip.heading);
    base.setPosition(lip.x, lip.y, lip.z);
    for (const [i, x] of [-7.4, 7.4].entries()) {
      const local = M(x, 7.6, 3.6);
      eyes.setMatrixAt(i, base.clone().multiply(local));
    }
    eyes.frustumCulled = false;
    scene.add(eyes);
  }

  // Rampas S y M: lomos de hueso.
  const humps: THREE.BufferGeometry[] = [];
  for (const z of track.zones) {
    if (z.type !== "ramp" || !z.size || z.size === "L") continue;
    const spec = RAMP[z.size];
    const lip = pointAt(track, z.to);
    const g = humpGeometry(spec.len, spec.lip, Math.min(6.5, lip.width * 0.42));
    g.applyMatrix4(M(lip.x, lip.y, lip.z, 0, lip.heading));
    humps.push(g);
  }
  if (humps.length) scene.add(new THREE.Mesh(merge(humps), toon));

  // Laguna bajo el salto. Translúcida para no competir con el asfalto.
  if (big) {
    const mid = pointAt(track, big.to + 18);
    const waterY = mid.y - 1.6;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(34, 28),
      new THREE.MeshBasicMaterial({ color: ESPECTRO, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(mid.x, waterY, mid.z);
    scene.add(disc);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(32, 36, 28),
      new THREE.MeshBasicMaterial({ color: ESPECTRO, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(mid.x, waterY + 0.05, mid.z);
    scene.add(rim);
    const mist = new THREE.Sprite(
      new THREE.SpriteMaterial({ color: ESPECTRO, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    mist.scale.set(48, 18, 1);
    mist.position.set(mid.x, waterY + 1.2, mid.z);
    scene.add(mist);
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
  const trunks = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 1.4, 2, 6), toonMaterial({ color: HUESO }), 16);
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), toonMaterial({ color: ANIMA }), 16);
  const tombs = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.35, 0.7, 2, 6), toonMaterial({ color: HUESO }), 12);
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
