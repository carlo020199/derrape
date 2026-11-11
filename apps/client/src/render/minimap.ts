import { pointAt, type Track } from "@derrape/shared";

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
  }

  private project(x: number, z: number): [number, number] {
    const w = this.canvas.width - this.pad * 2;
    const h = this.canvas.height - this.pad * 2;
    const sx = (x - this.minX) / Math.max(1e-3, this.maxX - this.minX);
    const sz = (z - this.minZ) / Math.max(1e-3, this.maxZ - this.minZ);
    return [this.pad + sx * w, this.pad + (1 - sz) * h];
  }

  draw(karts: { x: number; z: number; me?: boolean; color: string }[], startDist = 0, track?: Track) {
    const c = this.ctx;
    const { width: W, height: H } = this.canvas;
    c.clearRect(0, 0, W, H);
    c.fillStyle = "rgb(0 0 0 / 0.45)";
    c.beginPath();
    c.roundRect(0, 0, W, H, 10);
    c.fill();

    if (this.path.length < 2) return;
    c.strokeStyle = "rgb(255 255 255 / 0.55)";
    c.lineWidth = 2;
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
      c.fillStyle = "#fff";
      c.fillRect(sx - 2, sy - 2, 4, 4);
    }

    for (const k of karts) {
      const [x, y] = this.project(k.x, k.z);
      c.fillStyle = k.color;
      c.beginPath();
      c.arc(x, y, k.me ? 4.5 : 3, 0, Math.PI * 2);
      c.fill();
      if (k.me) {
        c.strokeStyle = "#fff";
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
  }
}
