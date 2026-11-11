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
export function projectMinimap(x: number, z: number, bounds: MapBounds, width: number, height: number, pad = 10): [number, number] {
  const w = width - pad * 2;
  const h = height - pad * 2;
  const sx = (x - bounds.minX) / Math.max(1e-3, bounds.maxX - bounds.minX);
  const sz = (z - bounds.minZ) / Math.max(1e-3, bounds.maxZ - bounds.minZ);
  return [pad + (1 - sx) * w, pad + (1 - sz) * h];
}

/** Minimapa 2D del circuito (canvas HTML encima del juego). */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private path: { x: number; z: number }[] = [];
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
    for (let i = 0; i < track.points.length; i += step) {
      const p = track.points[i]!;
      this.path.push({ x: p.x, z: p.z });
    }
    const xs = this.path.map((p) => p.x);
    const zs = this.path.map((p) => p.z);
    this.minX = Math.min(...xs);
    this.maxX = Math.max(...xs);
    this.minZ = Math.min(...zs);
    this.maxZ = Math.max(...zs);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private project(x: number, z: number): [number, number] {
    return projectMinimap(x, z, { minX: this.minX, maxX: this.maxX, minZ: this.minZ, maxZ: this.maxZ }, this.canvas.width, this.canvas.height, this.pad);
  }

  draw(karts: { x: number; z: number; me?: boolean; color: string }[], startDist = 0, track?: Track) {
    const c = this.ctx;
    const { width: W, height: H } = this.canvas;
    c.clearRect(0, 0, W, H);

    if (this.path.length < 2) return;
    c.strokeStyle = "#F3E7D3";
    c.lineWidth = 3;
    c.lineJoin = "round";
    c.beginPath();
    this.path.forEach((p, i) => {
      const [x, y] = this.project(p.x, p.z);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    c.closePath();
    c.stroke();

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
