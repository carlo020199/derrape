import * as THREE from "three";

/**
 * Cúpula con degradado por vértice, del cenit al horizonte.
 * El radio tiene que caber en `camera.far` (una esfera de 500 m se recortaría
 * con el plano lejano a 260 m y volvería el cielo negro). La niebla no la tiñe.
 * En carrera hay que recentrarla en la cámara: la pista es más grande que el radio.
 */
export function createGradientSky(zenith: number, horizon: number, radius = 230): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 16, 8);
  const pos = geo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(zenith);
  const hor = new THREE.Color(horizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / radius;
    const t = THREE.MathUtils.smoothstep(y, -0.05, 0.72);
    c.copy(hor).lerp(top, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = "cielo";
  return mesh;
}

/** Aclara un color hacia el blanco (la luz de hemisferio no puede ser el cielo crudo: es de noche). */
export function lighten(color: number, t: number): THREE.Color {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), t);
}
