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
          return {
            fillStyle: "",
            font: "",
            textAlign: "",
            textBaseline: "",
            createRadialGradient: () => grad,
            createLinearGradient: () => grad,
            fillRect() {},
            fillText() {},
          };
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
    if (!mesh.visible || !mesh.geometry) return;
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
  ["lia", "chispa", 0xff6a1f],
  ["kiko", "pulga", 0x2e86de],
  ["toni", "bolido", 0xffd23f],
  ["tocho", "tanque", 0x2ecc71],
  ["nonna-pina", "furgo", 0x9b5de5],
  ["lia", "centella", 0xe63946],
  ["kiko", "mosquito", 0x00b4d8],
  ["toni", "grillo", 0xf472b6],
] as const;

async function one(id: string) {
  const entry = TRACKS.find((t) => t.id === id)!;
  const def = await entry.load();
  const track = buildTrackFromDef(def);
  const theme = THEMES[def.theme];
  const scene = new THREE.Scene();
  scene.add(createGradientSky(theme.sky, theme.horizon, 230));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial());
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  scene.add(createTrackMesh(track, theme.track));
  theme.decorate(scene, track, def);
  new BlobShadows(scene);
  const pose = gridPose(track, 0);
  const cam = new THREE.PerspectiveCamera(CAMERA.baseFov + CAMERA.portraitExtraFov, 390 / 844, 0.1, 260);
  const fx = Math.sin(pose.heading);
  const fz = Math.cos(pose.heading);
  cam.position.set(pose.x - fx * CAMERA.portraitDistance, pose.y + CAMERA.portraitHeight, pose.z - fz * CAMERA.portraitDistance);
  cam.lookAt(pose.x + fx * CAMERA.lookAhead, pose.y + 0.8, pose.z + fz * CAMERA.lookAhead);
  cam.updateProjectionMatrix();
  for (let i = 0; i < karts.length; i++) {
    const [c, k, color] = karts[i] ?? karts[0]!;
    const model = createKartModel(color, c, k);
    // Delante de la cámara, como en una carrera: si no, la parrilla queda a la espalda y no cuenta.
    const ahead = pointAt(track, 8 + i * 6, (i % 2 === 0 ? 1 : -1) * 1.6);
    model.root.position.set(ahead.x, ahead.y, ahead.z);
    model.root.rotation.y = ahead.heading;
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
