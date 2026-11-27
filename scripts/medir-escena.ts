// Cuenta llamadas de dibujo y triángulos de una carrera en la parrilla.
// Misma regla que el renderer: un objeto entra entero si su esfera toca el frustum
// (un InstancedMesh no descarta instancias sueltas). Sin WebGL: el canvas se simula.

import * as THREE from "three";
import { TRACKS, buildTrackFromDef, gridPose, pointAt } from "@derrape/shared";
import { createKartModel } from "../apps/client/src/render/kartModel";
import { THEMES } from "../apps/client/src/render/themes";
import { createTrackMesh } from "../apps/client/src/render/trackMesh";
import { createGradientSky } from "../apps/client/src/render/sky";
import { BlobShadows } from "../apps/client/src/render/blobShadow";
import { Fire } from "../apps/client/src/render/flames";
import { ItemsView } from "../apps/client/src/render/itemsView";
import { createItemBoxes } from "@derrape/shared";
import { CAMERA } from "../apps/client/src/render/chaseCamera";

const g = globalThis as { document?: unknown };
if (!g.document) {
  g.document = {
    createElement() {
      return {
        width: 64,
        height: 64,
        getContext() {
          const grad = { addColorStop() {} };
          // Cualquier método de dibujo es un no-op (arc, stroke, roundRect…): solo se mide la geometría.
          const state: Record<string, unknown> = { createRadialGradient: () => grad, createLinearGradient: () => grad, measureText: () => ({ width: 1 }) };
          return new Proxy(state, {
            get: (t, k: string) => (k in t ? t[k] : () => {}),
            set: (t, k: string, v) => ((t[k] = v), true),
          });
        },
      };
    },
  };
}

function trisOf(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  if (!pos) return 0;
  return geo.index ? geo.index.count / 3 : pos.count / 3;
}

function count(scene: THREE.Scene, camera: THREE.Camera) {
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let calls = 0;
  let triangles = 0;
  const kinds: Record<string, number> = {};
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.geometry) return;
    for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (!p.visible) return;
    if (!(mesh as THREE.InstancedMesh).isInstancedMesh && !mesh.isMesh && !(mesh as unknown as THREE.Points).isPoints) return;
    if (mesh.frustumCulled !== false) {
      const inst = mesh as THREE.InstancedMesh;
      if (inst.isInstancedMesh) inst.computeBoundingSphere();
      else if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const sphere = (inst.isInstancedMesh ? inst.boundingSphere : mesh.geometry.boundingSphere)!.clone();
      sphere.applyMatrix4(mesh.matrixWorld);
      if (!frustum.intersectsSphere(sphere)) return;
    }
    calls++;
    const n = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
    const t = trisOf(mesh.geometry) * n;
    triangles += t;
    const key = mesh.name || mesh.geometry.type || mesh.type;
    kinds[key] = (kinds[key] ?? 0) + t;
  });
  return { calls, triangles: Math.round(triangles), kinds };
}

const karts = [
  ["lia", "hueso", 0xff6a1f],
  ["calavera-chispas", "medianoche", 0x2e86de],
  ["lia", "hueso", 0xffd23f],
  ["tocho", "tanque", 0x2ecc71],
  ["nonna-pina", "furgo", 0x9b5de5],
  ["calavera-chispas", "medianoche", 0xe63946],
  ["kiko", "mosquito", 0x00b4d8],
  ["toni", "grillo", 0xf472b6],
] as const;

async function one(id: string) {
  const entry = TRACKS.find((t) => t.id === id)!;
  const def = await entry.load();
  const track = buildTrackFromDef(def);
  const theme = THEMES[def.theme];
  const scene = new THREE.Scene();
  scene.add(createGradientSky(theme.sky, theme.skyHorizon ?? theme.horizon, 230));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial());
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  scene.add(createTrackMesh(track, theme.track));
  theme.decorate(scene, track, def);
  new BlobShadows(scene);
  const pose = gridPose(track, 0);
  const cam = new THREE.PerspectiveCamera(CAMERA.baseFov + (track.relief ? CAMERA.reliefPortraitExtraFov : CAMERA.portraitExtraFov), 390 / 844, 0.1, 260);
  const fx = Math.sin(pose.heading);
  const fz = Math.cos(pose.heading);
  // Misma cámara que la carrera: en circuitos con relieve (Ánimas) es la de relieve en vertical.
  const dist = track.relief ? CAMERA.reliefPortraitDistance : CAMERA.portraitDistance;
  const height = track.relief ? CAMERA.reliefPortraitHeight : CAMERA.portraitHeight;
  const look = track.relief ? CAMERA.reliefPortraitLookAhead : CAMERA.lookAhead;
  cam.position.set(pose.x - fx * dist, pose.y + height, pose.z - fz * dist);
  cam.lookAt(pose.x + fx * look, pose.y + 0.8, pose.z + fz * look);
  cam.updateProjectionMatrix();
  for (let i = 0; i < karts.length; i++) {
    const [c, k, color] = karts[i] ?? karts[0]!;
    const model = createKartModel(color, c, k);
    // Delante de la cámara, como en una carrera: si no, la parrilla queda a la espalda y no cuenta.
    const ahead = pointAt(track, 8 + i * 6, (i % 2 === 0 ? 1 : -1) * 1.6);
    model.root.position.set(ahead.x, ahead.y, ahead.z);
    model.root.rotation.y = ahead.heading;
    model.setDetail(cam.position.distanceTo(model.root.position) < 15);
    scene.add(model.root);
  }
  const fire = new Fire(scene);
  fire.begin();
  fire.end(0.016);
  const world = { track, karts: [], boxes: createItemBoxes(track, def.itemRows, 4), oils: [], rockets: [], random: Math.random };
  scene.add(new ItemsView(world as never).group);
  const sky = scene.getObjectByName("cielo");
  if (sky) sky.position.copy(cam.position);
  return { id, theme: def.theme, ...count(scene, cam) };
}

const ids = TRACKS.map((t) => t.id);
const rows = [];
for (const id of ids) rows.push(await one(id));
console.log(JSON.stringify(rows, null, 2));

// Piloto + coche: triángulos de cerca (sin contorno) y lejos (modelo barato), peor pareja del catálogo.
{
  const { CHARACTERS, KARTS } = await import("@derrape/shared");
  const tris = (m: ReturnType<typeof createKartModel>) => {
    let n = 0;
    m.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      let p: THREE.Object3D | null = o;
      let visible = true;
      while (p) {
        if (!p.visible) visible = false;
        p = p.parent;
      }
      if (mesh.isMesh && mesh.name !== "contorno" && mesh !== m.shield && visible) n += trisOf(mesh.geometry);
    });
    return n;
  };
  let near = { n: 0, par: "" };
  let far = { n: 0, par: "" };
  const pairs: Record<string, { cerca: number; lejos: number }> = {};
  for (const c of CHARACTERS) {
    for (const k of KARTS) {
      const m = createKartModel(0xff6a1f, c.id, k.id);
      m.setDetail(true);
      const cerca = tris(m);
      m.setDetail(false);
      const lejos = tris(m);
      if (cerca > near.n) near = { n: cerca, par: `${c.id}+${k.id}` };
      if (lejos > far.n) far = { n: lejos, par: `${c.id}+${k.id}` };
      if ((c.id === "lia" && k.id === "hueso") || (c.id === "calavera-chispas" && k.id === "medianoche")) pairs[`${c.id}+${k.id}`] = { cerca, lejos };
    }
  }
  console.log(JSON.stringify({ pilotoYkart: { parejaMaxCerca: near, parejaMaxLejos: far, release1: pairs } }, null, 2));
}
