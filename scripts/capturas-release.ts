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
const SHOTS_BASE = [
  { name: "a-salida", foto: "-16,0,0" }, // detrás del arco de salida
  { name: "b-recta-campanario", foto: "14,0,0" }, // recta de salida con el campanario a la izquierda
  { name: "c-curva-valla", foto: "740,0,0" }, // curva peraltada con vallas de calaveras
  { name: "d-laguna", foto: "197,0,64" }, // eses con la laguna delante
  // Extra para C9: cámara delante del kart (?vista=k,distancia,altura,giro°) para ver la cara del piloto y el morro del coche.
  { name: "e-frontal", foto: "14,0,0", vista: "k,6.2,2.3,28" },
];
// FOTOS="nombre:metros,lateral,giro;otra:…" sustituye las posiciones (para probar encuadres).
const SHOTS: { name: string; foto: string; vista?: string }[] = process.env.FOTOS
  ? process.env.FOTOS.split(";").map((t) => ({ name: t.split(":")[0]!, foto: t.split(":")[1]!, vista: t.split(":")[2] }))
  : SHOTS_BASE;

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
      let bloques = 0, planosB = 0, planosRel = 0;
      const by0 = Math.floor((H * 0.4) / bs);
      const rowsN = Math.floor(H / bs) - by0;
      const colsN = Math.floor(W / bs);
      const flatGrid: boolean[] = new Array(rowsN * colsN).fill(false);
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
          if (sd < 0.03) {
            planosB++;
            flatGrid[(by - by0) * colsN + bx] = true;
          }
          if (sd / Math.max(1e-6, s / n) < 0.03) planosRel++;
        }
      }
      planos = planosB / bloques;
      const planosR = planosRel / bloques;
      // Región plana contigua más grande (bloques planos conectados en 4 direcciones), en % de la pantalla.
      const seen = new Array(flatGrid.length).fill(false);
      let mayor = 0;
      for (let k = 0; k < flatGrid.length; k++) {
        if (!flatGrid[k] || seen[k]) continue;
        let n = 0;
        const pila = [k];
        seen[k] = true;
        while (pila.length) {
          const c = pila.pop()!;
          n++;
          const cx = c % colsN, cy = Math.floor(c / colsN);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= colsN || ny >= rowsN) continue;
            const nk = ny * colsN + nx;
            if (flatGrid[nk] && !seen[nk]) { seen[nk] = true; pila.push(nk); }
          }
        }
        mayor = Math.max(mayor, n);
      }
      const regionMayor = (mayor * bs * bs) / (W * H);
      const pct = (n: number) => Math.round((n / (W * H)) * 10000) / 100;
      return {
        c2_moradoPct: pct(morado),
        c2_casiNegroPct: pct(negro),
        c3_lagunaPct: pct(laguna_),
        c3_lagunaTercioMedioSuperiorPct: pct(lagunaSup),
        c7_bloquesPlanosPctDelTerrenoVisible: Math.round(planos * 10000) / 100,
        // Misma cuenta con «desviación < 3 %» en relativo (σ / media del bloque): es la lectura literal de DALI C7.
        // Región plana contigua mayor (σ absoluta < 0,03) como % del área de la pantalla: DALI C7 pide ≤ 10 %.
        c7_regionPlanaMayorPctPantalla: Math.round(regionMayor * 10000) / 100,
        c7_bloquesPlanosRelativoPct: Math.round(planosR * 10000) / 100,
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
  await page.goto(`${base}/?track=${TRACK}&foto=${s.foto}${s.vista ? `&vista=${s.vista}` : ""}${process.env.EXTRA ?? ""}`, { timeout: 120000 });
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 60000 });
  await page.waitForTimeout(Number(process.env.ASENTAR ?? 6000)); // cámara asentada (por software va a ~20 fps)
  await page.addStyleTag({ content: "#countdown, #wrong-way, #loading, #touch-help { display: none !important }" });
  const png = await page.screenshot({ path: `${out}/${s.name}.png` });
  // ms/fotograma con WebGL por software (SwiftShader): orientativo, no es un iPhone.
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const t0 = performance.now();
        let n = 0;
        const tick = () => {
          if (++n >= 20) resolve((performance.now() - t0) / n);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  const info = await page.evaluate(() => {
    const e = (window as unknown as { __escena: { renderer: { info: { render: { calls: number; triangles: number } } } } }).__escena;
    return { calls: e.renderer.info.render.calls, triangles: e.renderer.info.render.triangles };
  });
  resultado[s.name] = { ...(await metricas(page, png)), renderInfo: info, msPorFotogramaSoftware: Math.round(ms * 10) / 10 };
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
