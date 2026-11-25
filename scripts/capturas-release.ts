// Capturas del release 1 en vertical 390×844 @2x + métricas de color (C2, C3, C7) y renderer.info.
//
// Uso (con el cliente en marcha: `npm run dev -w @derrape/client`):
//   npx tsx scripts/capturas-release.ts [urlBase] [carpetaSalida] [personaje] [coche]
// Por defecto: http://localhost:5173, docs/release-v1/capturas, lia, su coche (hueso / medianoche).
// Usa el Chrome del sistema (CHROME_PATH para cambiarlo) con WebGL por software (SwiftShader).
// Escribe: a-salida.png, b-recta-campanario.png, c-curva-valla.png, d-laguna.png, seleccion-<personaje>.png,
// hoja-*.png (captura junto a ejemplo1/ejemplo2) y metricas.json (porcentajes de color y renderer.info por captura).

import { chromium, type Page } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? "docs/release-v1/capturas";
const character = process.argv[4] ?? "lia";
// Cada piloto del release va con su coche (Lía + Hueso, Calavera Chispas + Medianoche).
const kart = process.argv[5] ?? (character === "calavera-chispas" ? "medianoche" : "hueso");
const TRACK = "laguna-de-las-animas";

// ?foto=<metros>,<lateral>,<giro°>. Ajustar al trazado si cambia la Laguna.
const SHOTS = [
  { name: "a-salida", foto: "0,0,0" },
  { name: "b-recta-campanario", foto: "120,0,0" },
  { name: "c-curva-valla", foto: "520,0,0" },
  { name: "d-laguna", foto: "300,0,0" },
];

// --- Color ---
const PALETA_MORADOS = ["#120F1E", "#1E1830", "#2E2547", "#5B4E7A", "#9B6BFF", "#6B3FD6", "#4A3F66", "#3A3352"];
const LAGUNA = ["#1FA896", "#3FF2C8", "#7FFFE0"];

/** Se ejecuta en el navegador: recibe el PNG y devuelve porcentajes. */
async function metricas(page: Page, png: Buffer) {
  return page.evaluate(
    async ({ b64, morados, laguna }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const { data, width: W, height: H } = g.getImageData(0, 0, c.width, c.height);
      const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lab = ([r, g2, b]: number[]) => {
        const [R, G, B] = [lin(r!), lin(g2!), lin(b!)];
        const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
        const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
        const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
        const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
      };
      const dE = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
      const mor = (morados as string[]).map((h) => lab(hex(h)));
      // Degradado de la laguna: 8 muestras entre #1FA896 y #7FFFE0 (pasando por #3FF2C8).
      const lag: number[][] = [];
      const lc = (laguna as string[]).map(hex);
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const [p, q, u] = t < 0.5 ? [lc[0]!, lc[1]!, t * 2] : [lc[1]!, lc[2]!, (t - 0.5) * 2];
        lag.push(lab(p.map((v, k) => v + (q[k]! - v) * u!)));
      }
      let morado = 0, negro = 0, laguna_ = 0, lagunaSup = 0, planos = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const r = data[i]!, gg = data[i + 1]!, b = data[i + 2]!;
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn;
          let h = 0;
          if (d) h = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
          h = (h * 60 + 360) % 360;
          if (mx / 255 < 0.08) negro++;
          const L = lab([r, gg, b]);
          if ((d && h >= 250 && h <= 290) || mor.some((m) => dE(L, m) < 20)) morado++;
          if (lag.some((m) => dE(L, m) < 15)) {
            laguna_++;
            if (y < H * 0.67 && y > H * 0.2) lagunaSup++;
          }
        }
      }
      // C7: laterales (15 % + 15 %) con varianza > 0 y regiones planas (bloques 32×32 con desviación < 3 %) fuera del cielo.
      const bs = 32 * 2;
      let bloques = 0, planosB = 0;
      for (let by = Math.floor(H * 0.4 / bs); by < Math.floor(H / bs); by++) {
        for (let bx = 0; bx < Math.floor(W / bs); bx++) {
          let s = 0, s2 = 0, n = 0;
          for (let y = by * bs; y < (by + 1) * bs; y++)
            for (let x = bx * bs; x < (bx + 1) * bs; x++) {
              const i = (y * W + x) * 4;
              const v = (data[i]! + data[i + 1]! + data[i + 2]!) / 3 / 255;
              s += v; s2 += v * v; n++;
            }
          const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
          bloques++;
          if (sd < 0.03) planosB++;
        }
      }
      planos = planosB / bloques;
      const pct = (n: number) => Math.round((n / (W * H)) * 10000) / 100;
      return {
        c2_moradoPct: pct(morado),
        c2_casiNegroPct: pct(negro),
        c3_lagunaPct: pct(laguna_),
        c3_lagunaTercioMedioSuperiorPct: pct(lagunaSup),
        c7_bloquesPlanosPctDelTerrenoVisible: Math.round(planos * 10000) / 100,
        ancho: W,
        alto: H,
      };
    },
    { b64: png.toString("base64"), morados: PALETA_MORADOS, laguna: LAGUNA },
  );
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
});
mkdirSync(out, { recursive: true });
const resultado: Record<string, unknown> = { fecha: new Date().toISOString(), personaje: character, kart: kart ?? "por defecto" };

const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
// tsx inyecta __name en las funciones que van al navegador.
await ctx.addInitScript("window.__name = (f) => f;");
await ctx.addInitScript(
  ([c, k]) => {
    const prof = JSON.parse(localStorage.getItem("derrape.profile") ?? "{}");
    prof.character = c;
    if (k) prof.kart = k;
    localStorage.setItem("derrape.profile", JSON.stringify(prof));
  },
  [character, kart ?? ""],
);
const page = await ctx.newPage();
const errores: string[] = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

for (const s of SHOTS) {
  await page.goto(`${base}/?track=${TRACK}&foto=${s.foto}`);
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 60000 });
  await page.waitForTimeout(2500); // cámara asentada
  await page.addStyleTag({ content: "#countdown, #wrong-way, #loading, #touch-help { display: none !important }" });
  const png = await page.screenshot({ path: `${out}/${s.name}.png` });
  const info = await page.evaluate(() => {
    const e = (window as unknown as { __escena: { renderer: { info: { render: { calls: number; triangles: number } } } } }).__escena;
    return { calls: e.renderer.info.render.calls, triangles: e.renderer.info.render.triangles };
  });
  resultado[s.name] = { ...(await metricas(page, png)), renderInfo: info };
}

// Selección de piloto (pantalla «Piloto y coche»).
await page.goto(base);
await page.click("#home-garage");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/seleccion-${character}.png` });

// Hojas comparativas: captura | referencia (ejemplo1 para carrera, ejemplo2 para pilotos).
const REF = "docs/release-v1/referencias";
const uri = (f: string) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const hojas: [string, string, string][] = [
  ...SHOTS.map((s): [string, string, string] => [`${out}/${s.name}.png`, `${REF}/ejemplo1_2026-11-13.png`, `${out}/hoja-${s.name}.png`]),
  [`${out}/seleccion-${character}.png`, `${REF}/ejemplo2_2026-11-20.png`, `${out}/hoja-seleccion-${character}.png`],
];
const hoja = await ctx.newPage();
await hoja.setViewportSize({ width: 1000, height: 860 });
for (const [a, b, dest] of hojas) {
  await hoja.setContent(`<body style="margin:0;background:#120F1E;display:flex;gap:8px;align-items:flex-start"><img src="${uri(a)}" style="height:850px"><img src="${uri(b)}" style="height:850px"></body>`);
  await hoja.screenshot({ path: dest });
}

resultado.erroresDeConsola = errores;
writeFileSync(`${out}/metricas.json`, JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado, null, 2));
await browser.close();
