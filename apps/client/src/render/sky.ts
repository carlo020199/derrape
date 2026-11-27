import * as THREE from "three";

/**
 * Cúpula con degradado por vértice, del cenit al horizonte.
 * El radio tiene que caber en `camera.far` (una esfera de 500 m se recortaría
 * con el plano lejano a 260 m y volvería el cielo negro). La niebla no la tiñe.
 * En carrera hay que recentrarla en la cámara: la pista es más grande que el radio.
 */
export function createGradientSky(zenith: number, horizon: number, radius = 230, glow?: number): THREE.Mesh {
  // Con toque de color en el horizonte hace falta más resolución vertical para que el degradado no se vea a franjas.
  const geo = glow === undefined ? new THREE.SphereGeometry(radius, 16, 8) : new THREE.SphereGeometry(radius, 24, 20);
  const pos = geo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(zenith);
  const hor = new THREE.Color(horizon);
  const tint = new THREE.Color(glow ?? horizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / radius;
    const t = THREE.MathUtils.smoothstep(y, -0.05, 0.72);
    c.copy(hor).lerp(top, t);
    // Franja del toque (#9B6BFF) justo sobre el horizonte, suave.
    if (glow !== undefined) c.lerp(tint, 0.38 * Math.exp(-Math.pow((y - 0.07) / 0.09, 2)));
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

/** Luna de hueso con halo. Un sprite, sin bloom. */
export function createMoon(): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, "rgba(243,231,211,1)");
  grd.addColorStop(0.45, "rgba(243,231,211,0.85)");
  grd.addColorStop(1, "rgba(243,231,211,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
  sprite.scale.set(22, 22, 1);
  sprite.position.set(-70, 48, -120);
  sprite.name = "luna";
  return sprite;
}

/** Aclara un color hacia el blanco (la luz de hemisferio no puede ser el cielo crudo: es de noche). */
export function lighten(color: number, t: number): THREE.Color {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), t);
}

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function flatColored(parts: { geo: THREE.BufferGeometry; color: number }[]) {
  const flats = parts.map((p) => ({ geo: p.geo.index ? p.geo.toNonIndexed() : p.geo, color: p.color }));
  let total = 0;
  for (const p of flats) total += p.geo.getAttribute("position").count;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  const c = new THREE.Color();
  for (const { geo, color } of flats) {
    const p = geo.getAttribute("position");
    c.set(color);
    for (let i = 0; i < p.count; i++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], (o + i) * 3);
      col.set([c.r, c.g, c.b], (o + i) * 3);
    }
    o += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

/**
 * Nubes toon en tres capas sobre la cúpula: un solo mesh, opaco. Cada nube es un racimo de discos
 * Niebla con la misma silueta más abajo en Sombra. Siguen a la cámara (hijas del cielo).
 */
export function createClouds(niebla: number, sombra: number, radius = 218): THREE.Mesh {
  const r = rng(77);
  const parts: { geo: THREE.BufferGeometry; color: number }[] = [];
  const layers = [
    { n: 16, elev: [0.04, 0.13], size: 26, mix: 0.55 },
    { n: 12, elev: [0.13, 0.25], size: 34, mix: 0.3 },
    { n: 8, elev: [0.25, 0.42], size: 40, mix: 0 },
  ];
  const base = new THREE.Color(niebla);
  const shade = new THREE.Color(sombra);
  const anima = new THREE.Color(0x9b6bff);
  for (const L of layers) {
    for (let k = 0; k < L.n; k++) {
      const az = r() * Math.PI * 2;
      const el = L.elev[0]! + r() * (L.elev[1]! - L.elev[0]!);
      const place = new THREE.Matrix4();
      const pos = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(radius);
      place.lookAt(pos, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)).setPosition(pos);
      // Opacas: los discos se pisan sin mezclarse. Arriba, borde claro Niebla con un toque de Ánima; abajo, Sombra.
      // El borde claro es el mismo en las tres capas (más Ánima que antes): contra el horizonte, que es casi Niebla, el de las capas bajas se perdía y solo quedaba la base oscura.
      const top = base.clone().lerp(anima, 0.34 - 0.08 * L.mix).getHex();
      // La base ya no es un contorno oscuro: se aclara hacia el tono medio (transparente de verdad no se puede: sin prueba de profundidad taparía el terreno).
      const bot = shade.clone().lerp(base.clone().lerp(anima, 0.34 - 0.08 * L.mix), 0.4).getHex();
      const puffs = 4 + Math.floor(r() * 3);
      const w = L.size * (0.8 + r() * 0.5);
      // Primero todas las bases (Sombra) y luego todos los bordes claros: una base nunca tapa el borde del puff vecino.
      const bots: typeof parts = [];
      const tops: typeof parts = [];
      const bellies: typeof parts = [];
      // Panza en tono medio entre el borde claro y la base: tres bandas (claro, medio, Sombra) en vez de un salto duro.
      const mid = base.clone().lerp(anima, 0.34 - 0.08 * L.mix).lerp(shade, 0.5).getHex();
      for (let i = 0; i < puffs; i++) {
        const u = (i / (puffs - 1) - 0.5) * w;
        const rad = w * (0.16 + 0.1 * Math.cos((i / (puffs - 1) - 0.5) * Math.PI)) * (0.8 + r() * 0.4);
        for (const [color, dy, dz, list, k] of [[bot, -rad * 0.22, 0, bots, 1], [top, rad * 0.08, 0.05, tops, 1], [mid, -rad * 0.1, 0.1, bellies, 0.9]] as const) {
          const g = new THREE.CircleGeometry(rad * k, 10);
          g.scale(1, 0.6, 1);
          g.applyMatrix4(new THREE.Matrix4().makeTranslation(u, dy * 0.6, dz));
          g.applyMatrix4(place);
          list.push({ geo: g, color });
        }
      }
      parts.push(...bots, ...tops, ...bellies);
    }
  }
  const mesh = new THREE.Mesh(
    flatColored(parts),
    // Sin prueba de profundidad: los discos de cada nube se pintan en orden (Sombra y encima el borde claro), sin z-fighting.
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, depthTest: false, depthWrite: false }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -0.5; // después de la cúpula y antes de las colinas (-0,4): las colinas las tapan
  mesh.name = "nubes";
  return mesh;
}

/** Colinas lejanas escalonadas: tres anillos de silueta morada, cada uno más claro cuanto más lejos. */
export function createHills(radius = 204): THREE.Mesh {
  const parts: { geo: THREE.BufferGeometry; color: number }[] = [];
  const layers = [
    { r: radius, color: 0x4f4370, h: 26, seed: 3 },
    { r: radius - 7, color: 0x3a3058, h: 20, seed: 8 },
    { r: radius - 14, color: 0x2e2547, h: 13, seed: 15 },
  ];
  const seg = 72;
  for (const L of layers) {
    const rr = rng(L.seed);
    const ph = [rr() * 6, rr() * 6, rr() * 6];
    const pos: number[] = [];
    const top = (i: number) => {
      const a = (i / seg) * Math.PI * 2;
      const n = 0.5 + 0.28 * Math.sin(a * 3 + ph[0]!) + 0.17 * Math.sin(a * 7 + ph[1]!) + 0.08 * Math.sin(a * 13 + ph[2]!);
      return 4 + L.h * Math.max(0.1, n);
    };
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a: number, y: number) => [Math.cos(a) * L.r, y, Math.sin(a) * L.r];
      const b0 = p(a0, -90);
      const b1 = p(a1, -90);
      const t0 = p(a0, top(i));
      const t1 = p(a1, top(i + 1));
      pos.push(...b0, ...t1, ...t0, ...b0, ...b1, ...t1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    parts.push({ geo: g, color: L.color });
  }
  const hills = flatColored(parts);
  // Las crestas son más claras que la base: nada de siluetas de un solo color.
  const hp = hills.getAttribute("position");
  const hc = hills.getAttribute("color");
  for (let i = 0; i < hp.count; i++) {
    const k = THREE.MathUtils.lerp(0.8, 1.22, THREE.MathUtils.smoothstep(hp.getY(i), -6, 30));
    hc.setXYZ(i, Math.min(1, hc.getX(i) * k), Math.min(1, hc.getY(i) * k), Math.min(1, hc.getZ(i) * k));
  }
  const mesh = new THREE.Mesh(
    hills,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, depthWrite: false }),
  );
  // Telón de fondo: se pinta antes que el mundo y no tapa lo que quede más lejos (el río lejano). Después de las nubes (-0,5).
  mesh.renderOrder = -0.4;
  mesh.frustumCulled = false;
  mesh.name = "colinas";
  return mesh;
}

/**
 * Bruma baja: un anillo con alfa por vértice (Niebla) que vela las colinas y la base de las nubes, más densa pegada al horizonte.
 * Un solo mesh traslúcido que prueba profundidad sin escribirla: lo más cercano que 186 m lo tapa y solo vela el cielo y lo muy lejano. Cuelga de la cúpula.
 */
export function createHaze(color: number, radius = 186): THREE.Mesh {
  const seg = 48;
  const rows = [
    [-30, 0.0],
    [0, 0.0],
    [5, 0.42],
    [18, 0.2],
    [44, 0.0],
  ] as const;
  const c = new THREE.Color(color);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const [y, a] of rows) {
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(t) * radius, y, Math.sin(t) * radius);
      col.push(c.r, c.g, c.b, a);
    }
  }
  for (let r = 0; r < rows.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * (seg + 1) + i;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, fog: false, depthTest: true, depthWrite: false }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.name = "bruma";
  return mesh;
}

/** Luna grande de Hueso con cráteres y un halo aditivo suave. Un disco y un sprite. */
export function createAnimasMoon(radius = 17): THREE.Group {
  const parts: { geo: THREE.BufferGeometry; color: number }[] = [{ geo: new THREE.CircleGeometry(radius, 36), color: 0xf3e7d3 }];
  for (const [x, y, s] of [[-0.35, 0.3, 0.26], [0.3, 0.1, 0.18], [-0.05, -0.38, 0.22], [0.42, -0.35, 0.1], [-0.5, -0.1, 0.09]] as const) {
    const g = new THREE.CircleGeometry(radius * s, 14);
    g.translate(x * radius, y * radius, 0.05);
    parts.push({ geo: g, color: 0xe2d5bf });
  }
  const disc = new THREE.Mesh(
    flatColored(parts),
    new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, transparent: true }),
  );
  // El halo aditivo va antes que el disco: si se pintara encima, el Ánima teñiría de rosa el Hueso de la luna.
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  grd.addColorStop(0, "rgba(155,107,255,0.22)");
  grd.addColorStop(0.3, "rgba(155,107,255,0.2)");
  grd.addColorStop(0.55, "rgba(155,107,255,0.08)");
  grd.addColorStop(1, "rgba(155,107,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  halo.scale.setScalar(radius * 4.2);
  halo.position.z = -0.1;
  halo.renderOrder = -0.7;
  disc.renderOrder = -0.6;
  const group = new THREE.Group();
  group.add(halo, disc);
  group.name = "luna-animas";
  return group;
}
