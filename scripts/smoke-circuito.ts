// Smoke del Desván de las Maravillas (fases 1 a 5: turbos de suelo, rampas-mueble, raíl triturbo, rampas gigantes, plataforma y asfalto pintado) en móvil 390×844 @2x: capturas fijas (?foto) y una práctica en solitario real
// con un dedo simulado (CDP) mientras se vigilan los errores de consola.
//
// Uso (con el cliente en marcha: `npm run dev -w @derrape/client`):
//   npx tsx scripts/smoke-circuito.ts [urlBase] [carpetaSalida]
// Usa el Chrome del sistema (CHROME_PATH para cambiarlo) con WebGL por software. Sale con código 1 si hay errores de consola.

import { chromium, type Page } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? "/workspace/derrape-circuito-capturas/fase6";
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
  { name: "16-rail-antes", foto: "1780,0,0" }, // el raíl triturbo empieza en 1.812 m
  { name: "17-rail-dentro", foto: "1830,0,0" }, // encima del raíl
  { name: "18-rail-lado", foto: "1800,6,-15" }, // desde el lado: el raíl es una línea de 2 m en una calzada de 16
  { name: "21-xl-plataforma-antes", foto: "1396,0,0" }, // rampa gigante que sube a la plataforma (1.420–1.436 m)
  { name: "22-plataforma-meseta", foto: "1500,0,0" }, // encima de la meseta, con la fila de cajas (1.510 m)
  { name: "23-plataforma-borde", foto: "1500,13,-80" }, // el borde del tablero y el vacío a un lado
  { name: "24-xl-salto-antes", foto: "746,0,0" }, // rampa gigante que termina en salto (770–786 m)
  { name: "25-xl-salto-lado", foto: "790,10,-60" },
  // Vistas libres (?vista=x,y,z,mirax,miray,miraz con la niebla quitada): el tablero y la cuña desde fuera.
  { name: "26-plataforma-lateral", foto: "0,0,0&vista=-60,16,-310,-55,2,-262", libre: true },
  { name: "27-xl-cuna-lateral", foto: "0,0,0&vista=-150,14,-285,-112,1,-261", libre: true },
  // Fase 5: asfalto pintado decorativo (zona rosa en el interior de la curva G, morada entre la diagonal F y la recta H).
  { name: "31-rosa-cenital", foto: "0,0,0&vista=-119,70,-165,-119,0,-199", libre: true },
  { name: "32-morada-cenital", foto: "0,0,0&vista=39,55,-195,39,0,-231", libre: true },
  { name: "33-rosa-desde-pista", foto: "1236,-3,0" }, // en la curva G, con la zona rosa a la derecha
  { name: "34-morada-desde-pista", foto: "1160,-5,0" }, // en la diagonal F, la morada queda al sur
  { name: "35-rosa-lateral", foto: "0,0,0&vista=-60,14,-170,-119,0,-199", libre: true },
  { name: "36-morada-lateral", foto: "0,0,0&vista=75,12,-215,39,0,-231", libre: true },
  // Fase 6: decorado de muebles gigantes (cámara de carrera) y vistas libres con niebla.
  { name: "40-decorado-salida", foto: "20,0,0" },
  { name: "41-decorado-recta", foto: "200,0,0" },
  { name: "42-decorado-curva-norte", foto: "420,-3,0" },
  { name: "43-decorado-eses", foto: "620,0,0" },
  { name: "44-decorado-diagonal", foto: "860,0,0" },
  { name: "45-decorado-inferior", foto: "1620,0,0" },
  { name: "46-decorado-libre-1", foto: "0,0,0&vista=-150,60,-60,-170,10,60", libre: true },
  { name: "47-decorado-libre-2", foto: "0,0,0&vista=100,70,150,180,10,20", libre: true },
];
// SOLO_CAPTURAS=1: solo las capturas fijas (para ajustar vistas rápido).
const soloCapturas = process.env.SOLO_CAPTURAS === "1";

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
  if (process.env.FILTRO && !new RegExp(process.env.FILTRO).test(shot.name)) continue;
  const page = await ctx.newPage();
  hook(page, shot.name);
  await page.goto(`${base}/?track=${TRACK}&foto=${shot.foto}`);
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 90000 });
  if ("libre" in shot) {
    await page.evaluate(() => {
      const e = (window as unknown as { __escena: { scene: { fog: unknown }; camera: { far: number; updateProjectionMatrix(): void } } }).__escena;
      e.scene.fog = null;
      e.camera.far = 3000;
      e.camera.updateProjectionMatrix();
    });
  }
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "#countdown, #wrong-way, #loading, #touch-help { display: none !important }" });
  await page.screenshot({ path: `${out}/${shot.name}.png` });
  info[shot.name] = await page.evaluate(() => {
    const e = (window as unknown as { __escena: { renderer: { info: { render: { calls: number; triangles: number } } } } }).__escena;
    return { ...e.renderer.info.render };
  });
  await page.close();
}

if (soloCapturas) {
  await browser.close();
  console.log(JSON.stringify({ errores: errors, renderer: info }, null, 1));
  process.exit(errors.length ? 1 : 0);
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
// --- Cadena de 3 S recorrida de verdad: ?foto deja el kart a 96 m, `correr=bot` lo conduce el piloto automático ---
// Un registrador en requestAnimationFrame anota cada despegue y aterrizaje (con WebGL por software el muestreo desde fuera se saltaba vuelos).
type Vuelo = { despegue: number; aterriza?: number; mult?: number; time?: number };
const cadena: { saltos: number; vuelos: Vuelo[]; capturas: string[] } = { saltos: 0, vuelos: [], capturas: [] };
{
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx1.newPage();
  hook(page, "cadena-en-vuelo");
  await page.goto(`${base}/?track=${TRACK}&foto=96,0,0&correr=bot`);
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 90000 });
  // Como texto: tsx inyecta `__name` en las funciones y no existe dentro de la página.
  await page.evaluate(`(() => {
    window.__vuelos = [];
    let was = false;
    const tick = () => {
      const k = window.__escena.kart;
      if (k.airborne && !was) window.__vuelos.push({ despegue: k.along });
      if (!k.airborne && was) {
        const v = window.__vuelos[window.__vuelos.length - 1];
        v.aterriza = k.along;
        v.mult = k.boostMult;
        v.time = k.boostTime;
      }
      was = k.airborne;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
  const t0 = Date.now();
  let shots = 0;
  while (Date.now() - t0 < 90000) {
    const vuelos = (await page.evaluate(() => (window as unknown as { __vuelos: Vuelo[] }).__vuelos)) as Vuelo[];
    const vuelo = vuelos[vuelos.length - 1];
    if (vuelos.length > shots && vuelo) {
      shots = vuelos.length;
      const name = `15-cadena-en-vuelo-${shots}.png`;
      await page.screenshot({ path: `${out}/${name}` });
      cadena.capturas.push(name);
    }
    if (vuelos.length >= 3 && vuelos[2]!.aterriza !== undefined) break;
    await page.waitForTimeout(30);
  }
  cadena.vuelos = (await page.evaluate(() => (window as unknown as { __vuelos: Vuelo[] }).__vuelos)) as Vuelo[];
  cadena.saltos = cadena.vuelos.length;
  await page.close();
  await ctx1.close();
}
// --- Raíl triturbo recorrido de verdad: ?foto deja el kart en la salida de la curva I, `correr=bot` lo conduce el piloto automático ---
const rail = { velocidadMax: 0, mult: 0, capturas: [] as string[] };
{
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx1.newPage();
  hook(page, "rail-triturbo");
  await page.goto(`${base}/?track=${TRACK}&foto=1745,0,0&correr=bot`);
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 90000 });
  await page.evaluate(`(() => {
    window.__rail = { max: 0, along: 0, tri: false };
    const tick = () => {
      const k = window.__escena.kart;
      if (k.speed > window.__rail.max) { window.__rail.max = k.speed; window.__rail.along = k.along; }
      if (k.triTime > 0) window.__rail.tri = true;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
  const t0 = Date.now();
  let shot = 0;
  let despues = 0;
  while (Date.now() - t0 < 60000) {
    const r = (await page.evaluate(() => (window as unknown as { __rail: { max: number; along: number; tri: boolean } }).__rail)) as { max: number; along: number; tri: boolean };
    rail.velocidadMax = r.max;
    if (r.tri && shot === 0) {
      shot = 1;
      await page.screenshot({ path: `${out}/19-rail-en-marcha.png` });
      rail.capturas.push("19-rail-en-marcha.png");
    }
    if (r.max > 77 && shot === 1) {
      shot = 2;
      await page.screenshot({ path: `${out}/20-rail-a-78.png` });
      rail.capturas.push("20-rail-a-78.png");
    }
    if (shot === 2 && ++despues > 40) break; // ~1,2 s después de llegar a 78 m/s
    await page.waitForTimeout(30);
  }
  await page.close();
  await ctx1.close();
}
// --- Rampas gigantes recorridas de verdad: el piloto automático sube a la plataforma (XL a 1.420 m) y salta la XL de la diagonal (770 m) ---
type VueloXL = { despegue: number; aterriza?: number; y?: number; cae?: boolean };
const gigantes: Record<string, { vuelos: VueloXL[]; capturas: string[] }> = {};
for (const [clave, desde, hasta] of [["plataforma", 1380, 1620], ["diagonal", 740, 900]] as const) {
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx1.newPage();
  hook(page, `xl-${clave}`);
  await page.goto(`${base}/?track=${TRACK}&foto=${desde},0,0&correr=bot`);
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 90000 });
  await page.evaluate(`(() => {
    window.__xl = [];
    let was = false;
    const tick = () => {
      const k = window.__escena.kart;
      if (k.airborne && !was) window.__xl.push({ despegue: k.along, cae: false });
      if (k.surface === 'fall' && window.__xl.length) window.__xl[window.__xl.length - 1].cae = true;
      if (!k.airborne && was) { const v = window.__xl[window.__xl.length - 1]; v.aterriza = k.along; v.y = k.groundY; }
      was = k.airborne;
      window.__along = k.along;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
  const rec = { vuelos: [] as VueloXL[], capturas: [] as string[] };
  const t0 = Date.now();
  let fotos = 0;
  let enVuelo = 0;
  while (Date.now() - t0 < 90000) {
    const vuelos = (await page.evaluate(() => (window as unknown as { __xl: VueloXL[] }).__xl)) as VueloXL[];
    const along = (await page.evaluate(() => (window as unknown as { __along: number }).__along)) as number;
    const vuelo = vuelos[vuelos.length - 1];
    // Una captura en pleno vuelo (a mitad) y otra ya aterrizado.
    if (vuelo && vuelo.aterriza === undefined && fotos === enVuelo * 2 && ++enVuelo > 0) {
      await page.waitForTimeout(250);
      const name = `28-${clave}-en-vuelo.png`;
      await page.screenshot({ path: `${out}/${name}` });
      rec.capturas.push(name);
      fotos++;
    }
    if (vuelo?.aterriza !== undefined && fotos === 1) {
      await page.waitForTimeout(400);
      const name = `29-${clave}-aterrizado.png`;
      await page.screenshot({ path: `${out}/${name}` });
      rec.capturas.push(name);
      fotos++;
    }
    if (along > hasta || fotos >= 2 && vuelo?.aterriza !== undefined && along > (vuelo.aterriza ?? 0) + 30) break;
    await page.waitForTimeout(30);
  }
  rec.vuelos = (await page.evaluate(() => (window as unknown as { __xl: VueloXL[] }).__xl)) as VueloXL[];
  gigantes[clave] = rec;
  await page.close();
  await ctx1.close();
}
// --- Caída de la plataforma y reaparición: el último checkpoint queda en la meseta (`reaparece=1486`) y el kart arranca a 9 m del eje (sin suelo) ---
// El respawn sucede dentro del paso de física: desde fuera solo se ve el contador de reapariciones y el kart ya vuelto a la calzada.
const caida = { reaparecio: false, along: 0, groundY: 0, surface: "", respawns: 0, capturas: [] as string[] };
{
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx1.newPage();
  hook(page, "caida-plataforma");
  await page.goto(`${base}/?track=${TRACK}&foto=1500,9,0&correr&reaparece=1486`);
  await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 90000 });
  await page.evaluate(`window.__r0 = 0`);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const r = (await page.evaluate(`({ respawns: window.__escena.respawns - window.__r0, along: window.__escena.kart.along, groundY: window.__escena.kart.groundY, surface: window.__escena.kart.surface })`)) as { respawns: number; along: number; groundY: number; surface: string };
    if (r.respawns >= 1) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/30-caida-reaparece.png` });
      caida.capturas.push("30-caida-reaparece.png");
      const post = (await page.evaluate(`({ along: window.__escena.kart.along, groundY: window.__escena.kart.groundY, surface: window.__escena.kart.surface, respawns: window.__escena.respawns - window.__r0 })`)) as { along: number; groundY: number; surface: string; respawns: number };
      Object.assign(caida, post, { reaparecio: true });
      break;
    }
    await page.waitForTimeout(30);
  }
  await page.close();
  await ctx1.close();
}
await browser.close();

const vmax = Math.max(...speeds.map((s) => s.kmh));
const summary = { errores: errors, cadena3S: cadena, railTriturbo: rail, gigantes, caidaPlataforma: caida, velocidadMaxKmh: vmax, velocidadSinTurboKmh: Math.round(26 * 3.6), muestras: speeds.length, renderer: info };
writeFileSync(`${out}/smoke.json`, JSON.stringify({ ...summary, velocidades: speeds }, null, 1));
console.log(JSON.stringify(summary, null, 1));
const cadenaOk = cadena.vuelos.length >= 3 && cadena.vuelos.slice(0, 3).every((v) => v.aterriza !== undefined && v.mult === 1.5 && (v.time ?? 0) > 0.3);
if (!cadenaOk) console.error("La cadena de 3 S no se recorrió completa con turbo ×1,5 al aterrizar");
const railOk = rail.velocidadMax > 77 && rail.velocidadMax <= 78.1;
if (!railOk) console.error(`El raíl triturbo no llegó a 78 m/s (máx. ${rail.velocidadMax.toFixed(1)})`);
const platOk = (gigantes.plataforma?.vuelos[0]?.aterriza ?? 0) > 1436 && (gigantes.plataforma?.vuelos[0]?.aterriza ?? 9e9) < 1555 && (gigantes.plataforma?.vuelos[0]?.y ?? 0) > 1.5 && gigantes.plataforma!.vuelos[0]!.cae === false;
if (!platOk) console.error("El bot no aterrizó en la plataforma tras la rampa gigante");
const diagOk = (gigantes.diagonal?.vuelos[0]?.aterriza ?? 0) - (gigantes.diagonal?.vuelos[0]?.despegue ?? 0) > 25;
if (!diagOk) console.error("La rampa gigante de la diagonal no terminó en un salto largo");
const caidaOk = caida.reaparecio && caida.respawns === 1 && caida.surface === "road" && caida.groundY > 2.5 && caida.along > 1486 && caida.along < 1502;
if (!caidaOk) console.error("Caer de la plataforma no reapareció bien en la meseta");
process.exit(errors.length || !cadenaOk || !railOk || !platOk || !diagOk || !caidaOk ? 1 : 0);
