import * as THREE from "three";

/** Etiqueta con el nombre encima de un kart (sprite: siempre mira a la cámara). */
export function createNameTag(name: string, color: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.font = "bold 34px system-ui, sans-serif";
  const w = Math.min(240, g.measureText(name).width + 36);
  g.fillStyle = "rgba(10, 12, 30, 0.7)";
  g.beginPath();
  g.roundRect((256 - w) / 2, 8, w, 48, 24);
  g.fill();
  g.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  g.beginPath();
  g.arc((256 - w) / 2 + 20, 32, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(name, 128 + 8, 33, 200);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sprite.scale.set(3.2, 0.8, 1);
  sprite.position.y = 2.4;
  return sprite;
}
