// Genera los iconos provisionales de la PWA (PNG) sin dependencias: `node scripts/make-icons.mjs`.
// Dibujo: fondo azul noche, círculo naranja y una franja blanca diagonal (estela de derrape).

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT = new URL("../apps/client/public/icons/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size);
      raw.set([r, g, b, 255], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [27, 31, 58];
const ORANGE = [255, 107, 53];
const WHITE = [255, 255, 255];

function icon(u, v) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const inCircle = dx * dx + dy * dy < 0.3 * 0.3;
  const stripe = Math.abs(u + v - 1.05) < 0.06 && inCircle;
  if (stripe) return WHITE;
  return inCircle ? ORANGE : BG;
}

for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  writeFileSync(new URL(name, OUT), png(size, icon));
}
console.log("Iconos generados en apps/client/public/icons/");
