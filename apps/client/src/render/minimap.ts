import { pointAt, type Track } from "@derrape/shared";

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Proyecta un punto del mundo al canvas.
 * +z queda arriba. +x se voltea: en la cámara de persecución, con el kart
 * mirando hacia +z, el +x del mundo está a su izquierda. Sin el volteo,
 * una curva a la izquierda se dibuja a la derecha.
 */
export function projectMinimap(x: number, z: number, bounds: MapBounds, width: number, height: number, pad = 14): [number, number] {
  const span = Math.max(1e-3, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  // Escala uniforme y margen: el canvas se recorta en círculo. Si el trazado
  // (un óvalo) llena el cuadrado, el trazo cae en el borde y desaparece.
  const fit = (Math.min(width, height) - pad * 2) * 0.72;
  const scale = fit / span;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;
  return [width / 2 - (x - midX) * scale, height / 2 - (z - midZ) * scale];
}

/** Minimapa 2D del circuito (canvas HTML encima del juego). */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private path: { x: number; z: number; y: number }[] = [];
  private ramps: { x: number; z: number; size: string }[] = [];
  private relief = false;
  private minY = 0;
  private maxY = 1;
  private minX = 0;
  private maxX = 1;
  private minZ = 0;
  private maxZ = 1;
  private pad = 10;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  setTrack(track: Track) {
    const step = Math.max(4, Math.floor(track.points.length / 80));
    this.path = [];
    this.relief = track.points.some((p) => Math.abs(p.bank) > 0.5);
    for (let i = 0; i < track.points.length; i += step) {
      const p = track.points[i]!;
      this.path.push({ x: p.x, z: p.z, y: p.y });
    }
    this.ramps = [];
    for (const z of track.zones) {
      if (z.type !== "ramp" || !z.size) continue;
      const p = pointAt(track, z.to);
      this.ramps.push({ x: p.x, z: p.z, size: z.size });
    }
    const ys = this.path.map((p) => p.y);
    this.minY = Math.min(...ys);
    this.maxY = Math.max(...ys);
    const xs = this.path.map((p) => p.x);
    const zs = this.path.map((p) => p.z);
    this.minX = Math.min(...xs);
    this.maxX = Math.max(...xs);
    this.minZ = Math.min(...zs);
    this.maxZ = Math.max(...zs);
    this.draw([], 0, track);
  }

  private project(x: number, z: number): [number, number] {
    return projectMinimap(x, z, { minX: this.minX, maxX: this.maxX, minZ: this.minZ, maxZ: this.maxZ }, this.canvas.width, this.canvas.height, this.pad);
  }

  draw(karts: { x: number; z: number; me?: boolean; color: string }[], startDist = 0, track?: Track) {
    const c = this.ctx;
    const { width: W, height: H } = this.canvas;
    c.clearRect(0, 0, W, H);

    if (this.path.length < 2) return;
    c.lineWidth = 3;
    c.lineJoin = "round";
    c.lineCap = "round";
    if (!this.relief) {
      c.strokeStyle = "#F3E7D3";
      c.beginPath();
      this.path.forEach((p, i) => {
        const [x, y] = this.project(p.x, p.z);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.closePath();
      c.stroke();
    } else {
      const span = Math.max(1, this.maxY - this.minY);
      for (let i = 0; i < this.path.length; i++) {
        const a = this.path[i]!;
        const b = this.path[(i + 1) % this.path.length]!;
        const t = ((a.y + b.y) / 2 - this.minY) / span;
        const shade = Math.round(90 + t * 150);
        c.strokeStyle = `rgb(${shade}, ${Math.round(shade * 0.92)}, ${Math.round(80 + t * 140)})`;
        c.beginPath();
        const [x0, y0] = this.project(a.x, a.z);
        const [x1, y1] = this.project(b.x, b.z);
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
      }
      const rampColor: Record<string, string> = { S: "#3FF2C8", M: "#FFB423", L: "#FF6A1F" };
      for (const r of this.ramps) {
        const [x, y] = this.project(r.x, r.z);
        c.fillStyle = rampColor[r.size] ?? "#FFB423";
        c.beginPath();
        c.moveTo(x, y - 5);
        c.lineTo(x + 4, y + 3);
        c.lineTo(x - 4, y + 3);
        c.closePath();
        c.fill();
      }
    }

    if (track) {
      const s = pointAt(track, startDist);
      const [sx, sy] = this.project(s.x, s.z);
      c.fillStyle = "#FFB423";
      c.fillRect(sx - 2, sy - 2, 4, 4);
    }

    for (const k of karts) {
      const [x, y] = this.project(k.x, k.z);
      c.fillStyle = k.color;
      c.beginPath();
      c.arc(x, y, k.me ? 4.5 : 3, 0, Math.PI * 2);
      c.fill();
      if (k.me) {
        c.strokeStyle = "#FFF7EA";
        c.lineWidth = 2;
        c.stroke();
      }
    }
  }
}
