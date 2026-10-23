import * as THREE from "three";

// Kart provisional hecho con cajas. Se sustituye por modelos en la Fase 7.
export interface KartModel {
  root: THREE.Group;
  /** Parte que se inclina/gira al derrapar (el root sigue el rumbo real). */
  body: THREE.Group;
  /** Posiciones locales de las ruedas traseras, para las chispas. */
  rearWheels: THREE.Vector3[];
  /** Burbuja del escudo (oculta si no hay escudo). */
  shield: THREE.Mesh;
}

const shieldGeo = new THREE.SphereGeometry(1.7, 16, 12);
const shieldMat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.3, depthWrite: false });

export function createKartModel(color = 0xff6b35): KartModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const box = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
    m.position.set(x, y, z);
    body.add(m);
    return m;
  };

  box(1.3, 0.35, 2.2, color, 0, 0.4, 0); // chasis
  box(0.9, 0.5, 0.7, 0x222831, 0, 0.8, -0.3); // asiento
  box(0.5, 0.5, 0.5, 0xffd6a5, 0, 1.25, -0.25); // piloto
  box(1.4, 0.12, 0.35, 0x222831, 0, 0.55, 1.15); // parachoques
  const wheel = 0x1b1b1b;
  for (const [x, z] of [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.75], [0.75, -0.75]] as const) {
    box(0.35, 0.5, 0.5, wheel, x, 0.25, z);
  }

  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.y = 0.8;
  shield.visible = false;
  root.add(shield);

  return {
    root,
    body,
    shield,
    rearWheels: [new THREE.Vector3(-0.75, 0.1, -0.9), new THREE.Vector3(0.75, 0.1, -0.9)],
  };
}
