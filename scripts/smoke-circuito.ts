// Smoke del Desván de las Maravillas (fases 1 y 2: turbos de suelo y rampas-mueble) en móvil 390×844 @2x: capturas fijas (?foto) y una práctica en solitario real
// con un dedo simulado (CDP) mientras se vigilan los errores de consola.
//
// Uso (con el cliente en marcha: `npm run dev -w @derrape/client`):
//   npx tsx scripts/smoke-circuito.ts [urlBase] [carpetaSalida]
// Usa el Chrome del sistema (CHROME_PATH para cambiarlo) con WebGL por software. Sale con código 1 si hay errores de consola.

import { chromium, type Page } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? "/workspace/derrape-circuito-capturas/fase2";
const TRACK = "desvan-de-las-maravillas";
mkdirSync(out, { recursive: true });

const SHOTS = [
  { name: "01-salida", foto: "-16,0,0" },
  { name: "02-turbo-azul-ancho", foto: "10,0,0" }, // azul ancho en 20–26 m, justo delante
  { name: "03-turbo-azul-franja", foto: "322,2.5,0" }, // franja azul en 330–338 m (lateral 1–4)
  { name: "04-turbo-naranja-ancho", foto: "460,0,0" }, // naranja ancho en 470–478 m
  { name: "05-turbo-naranja-franja", foto: "62,4.5,0" }, // naranja en franja en 70–78 m (lateral 3–6)
  { name: "09-cadena-3S-antes", foto: "96,0,0" }, // cadena de 3 rampas S (116 / 146 / 192 m), justo delante
  { name: "10-cadena-3S-entre", foto: "132,0,0" }, // entre la 1.ª y la 2.ª
  { name: "11-rampa-S-eses", foto: "696,0,0" }, // S sola a la salida de las eses (715 m)
  { name: "12-cadena-2M-antes", foto: "1066,0,0" }, // cadena de 2 M (1.090 / 1.130 m)
  { name: "13-cadena-2M-entre", foto: "1110,0,0" },
  { name: "14-rampa-lado", foto: "104,9,-50" }, // desde un lado: la cuña y el cabecero/cómoda
  { name: "06-eses", foto: "588,3,0" }, // la franja azul de la ese 2 (600–606 m, lateral 2–5)
];

const errors: string[] = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const hook = (page: Page, label: string) => {
  page.on("pageerror", (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${label}] console.error: ${m.text()}`);
  });
};

const info: Record<string, unknown> = {};
// --- Capturas fijas ---
for (const shot of SHOTS) {
  const page = await ctx.newPage();
  hook(page, shot.name);
  await page.goto(`${base}/?track=${TRACK}&foto=${shot.foto}`);
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "#countdown, #wrong-way, #loading, #touch-help { display: none !important }" });
  await page.screenshot({ path: `${out}/${shot.name}.png` });
  info[shot.name] = await page.evaluate(() => {
    const e = (window as unknown as { __escena: { renderer: { info: { render: { calls: number; triangles: number } } } } }).__escena;
    return { ...e.renderer.info.render };
  });
  await page.close();
}

// --- Vista general: cámara alta, sin niebla ---
{
  const page = await ctx.newPage();
  hook(page, "vista-general");
  await page.goto(`${base}/?track=${TRACK}&foto=0,0,0&vista=0,720,-15,0,0,-14`);
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 90000 });
  await page.evaluate(() => {
    const e = (window as unknown as { __escena: { scene: { fog: unknown }; camera: { far: number; updateProjectionMatrix(): void } } }).__escena;
    e.scene.fog = null;
    e.camera.far = 3000;
    e.camera.updateProjectionMatrix();
  });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "#countdown, #wrong-way, #loading, #touch-help, #hud { display: none !important }" });
  await page.screenshot({ path: `${out}/07-vista-general.png` });
  await page.close();
}

// --- Práctica en solitario real: un dedo apoyado (acelera) y sin arrastrar: recto por la recta de meta ---
// WebGL por software va a una fracción del tiempo real; se usa @1x para ir más rápido y se anota el reloj de carrera.
const speeds: { t: number; race: string; kmh: number }[] = [];
{
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx1.newPage();
  hook(page, "solitario");
  await page.goto(`${base}/?track=${TRACK}`);
  await page.waitForSelector("#hud-speed", { state: "attached", timeout: 90000 });
  const cdp = await ctx1.newCDPSession(page);
  const touch = (type: "touchStart" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await page.waitForTimeout(1500);
  await touch("touchStart", 195, 620);
  const t0 = Date.now();
  let shot = 0;
  const marks = [3, 8, 13, 20];
  while ((Date.now() - t0) / 1000 < Number(process.env.DURACION ?? 24)) {
    const t = (Date.now() - t0) / 1000;
    const kmh = Number(await page.locator("#hud-speed").textContent());
    speeds.push({ t: +t.toFixed(2), race: (await page.locator("#race-time").textContent()) ?? "", kmh });
    if (shot < marks.length && t >= marks[shot]!) {
      await page.screenshot({ path: `${out}/08-solitario-${shot + 1}.png` });
      shot++;
    }
    await page.waitForTimeout(200);
  }
  await touch("touchEnd", 195, 620);
  await page.close();
  await ctx1.close();
}
await browser.close();

const vmax = Math.max(...speeds.map((s) => s.kmh));
const summary = { errores: errors, velocidadMaxKmh: vmax, velocidadSinTurboKmh: Math.round(26 * 3.6), muestras: speeds.length, renderer: info };
writeFileSync(`${out}/smoke.json`, JSON.stringify({ ...summary, velocidades: speeds }, null, 1));
console.log(JSON.stringify(summary, null, 1));
process.exit(errors.length ? 1 : 0);
