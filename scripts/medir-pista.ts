// Mide los quiebros de las 12 pistas (trackSmoothness) y la malla de la pista (triángulos y
// llamadas de dibujo de `createTrackMesh`). Uso: npx tsx scripts/medir-pista.ts [salida.json]

import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { TRACKS, buildTrackFromDef, gridPose, pointAt } from "@derrape/shared";
import { measureSmoothness } from "../packages/shared/src/trackSmoothness";
import { THEMES } from "../apps/client/src/render/themes";
import { createTrackMesh } from "../apps/client/src/render/trackMesh";
import { CAMERA } from "../apps/client/src/render/chaseCamera";

// createTrackMesh solo usa el canvas para la línea de salida.
const g = globalThis as { document?: unknown };
if (!g.document) {
  g.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: "", fillRect() {} }) }),
  };
}

const round = (v: number, d = 3) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

const rows = [];
for (const entry of TRACKS) {
  const def = await entry.load();
  const track = buildTrackFromDef(def);
  const sm = measureSmoothness(track);
  const group = createTrackMesh(track, THEMES[def.theme].track);
  let calls = 0;
  let triangles = 0;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    calls++;
    triangles += m.geometry.index ? m.geometry.index.count / 3 : m.geometry.getAttribute("position").count / 3;
  });
  // Lo que ve la cámara de persecución en la parrilla (vertical, far 260): esfera de cada malla contra el frustum.
  const pose = gridPose(track, 0);
  const cam = new THREE.PerspectiveCamera(CAMERA.baseFov + CAMERA.portraitExtraFov, 390 / 844, 0.1, 260);
  const fx = Math.sin(pose.heading);
  const fz = Math.cos(pose.heading);
  cam.position.set(pose.x - fx * CAMERA.portraitDistance, pointAt(track, -6).y + CAMERA.portraitHeight, pose.z - fz * CAMERA.portraitDistance);
  cam.lookAt(pose.x + fx * CAMERA.lookAhead, pointAt(track, -6).y + 0.8, pose.z + fz * CAMERA.lookAhead);
  cam.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  let visCalls = 0;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.computeBoundingSphere();
    if (frustum.intersectsSphere(m.geometry.boundingSphere!)) visCalls++;
  });
  rows.push({
    id: entry.id,
    largo: round(track.length, 1),
    nodos: track.points.length,
    malla: { llamadas: calls, triangulos: Math.round(triangles), llamadasVisiblesEnParrilla: visCalls },
    quiebros: {
      pendienteMax: round(sm.maxGrade),
      cambioPendienteMax: round(sm.maxGradeChange, 4),
      radioValleMin: round(sm.minSagRadius, 1),
      peralteMax: round(sm.maxBank, 1),
      peralteRitmoMax: round(sm.maxBankRate, 2),
      peralteAceleracionMax: round(sm.maxBankAccel, 3),
      saltoNormalMax: round(sm.maxNormalJump, 2),
    },
    donde: sm.at,
  });
}
const out = JSON.stringify(rows, null, 2);
if (process.argv[2]) writeFileSync(process.argv[2], out + "\n");
else console.log(out);
