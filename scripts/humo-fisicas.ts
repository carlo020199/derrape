// Humo de físicas a 390x844 (práctica en solitario, Laguna de las Ánimas).
// Gas = dedo apoyado; giro = arrastre horizontal (pilotado en bucle cerrado con el bot de shared);
// en curva, arrastre largo (> driftTrigger) = salto + derrape; al enderezar se acorta = mini-turbo.
// Uso: npx tsx scripts/humo-fisicas.ts [urlBase] [carpetaSalida]
import { chromium } from "playwright-core";
import { botInput, buildTrackFromDef, TRACKS, TOUCH, type KartState } from "@derrape/shared";

const [base = "http://localhost:5174", out = "/workspace/derrape-hydrogen-capturas"] = process.argv.slice(2);
const def = await TRACKS.find((t) => t.id === "laguna-de-las-animas")!.load();
const track = buildTrackFromDef(def);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript("window.__name = (f) => f;");
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto(`${base}/?track=laguna-de-las-animas`);
await page.waitForFunction(() => (window as any).derrape?.session?.(), null, { timeout: 60000 });
const kart = () => page.evaluate(() => (window as any).derrape.session().debug().kart) as Promise<KartState & { surface: string; airborne: boolean }>;
let pid = 7;
const ptr = (type: string, x: number, y: number) =>
  page.evaluate(([type, x, y, pid]) => {
    document.querySelector("#touch-zone")!.dispatchEvent(
      new PointerEvent(type as string, { pointerId: pid as number, pointerType: "touch", clientX: x as number, clientY: y as number, bubbles: true, isPrimary: true }),
    );
  }, [type, x, y, pid] as const);
await page.waitForTimeout(5000); // cuenta atrás
const cx = 195, cy = 600;
await ptr("pointerdown", cx, cy);
const t0 = Date.now();
let driftStart = 0;
let shots = 0, drifts = 0, boosts = 0, maxCharge = 0, prevDrift = 0, prevBoost = 0, offroad = 0, n = 0, minY = Infinity, maxV = 0;
const lines: string[] = [];
while (Date.now() - t0 < 14000) {
  const t = Date.now() - t0;
  const s = await kart();
  const steer = botInput({ lane: 0, lookAhead: 10 }, s, track).steer;
  // En curva marcada y con velocidad: arrastre largo para derrapar. Si no, arrastre proporcional.
  const wantDrift = !process.env.SIN_DERRAPE && Math.abs(steer) > 0.3 && s.speed > 14;
  // El derrape del gesto dura hasta levantar el dedo: al acabar la curva (o tras 2,5 s) se levanta
  // y se vuelve a apoyar en el centro, como hace un jugador para soltar el mini-turbo.
  if (s.driftDir !== 0 && (Math.abs(steer) < 0.2 || Date.now() - driftStart > 2500)) {
    await ptr("pointerup", cx, cy);
    pid++;
    await ptr("pointerdown", cx, cy);
  }
  if (s.driftDir !== 0 && !prevDrift) driftStart = Date.now();
  const dx = wantDrift ? Math.sign(steer) * TOUCH.steerRange * 0.85 : steer * TOUCH.steerRange * (process.env.SIN_DERRAPE ? 0.59 : 0.55);
  await ptr("pointermove", cx + dx, cy - 4);
  n++; if (s.surface === "offroad") offroad++;
  if (s.driftDir && !prevDrift) drifts++;
  if (s.boostTime > prevBoost + 0.05) boosts++;
  prevDrift = s.driftDir; prevBoost = s.boostTime;
  maxCharge = Math.max(maxCharge, s.driftCharge); minY = Math.min(minY, s.y); maxV = Math.max(maxV, s.speed);
  if (n % 5 === 0) lines.push(`${t}ms v=${s.speed.toFixed(1)} steer=${steer.toFixed(2)} drift=${s.driftDir} carga=${s.driftCharge | 0} turbo=${s.boostTime.toFixed(2)} y=${s.y.toFixed(2)} ${s.surface}`);
  if ((s.driftDir && shots === 0 && t > 3000) || (s.boostTime > 0 && shots === 1) || (shots === 2 && t > 11000)) {
    await page.screenshot({ path: `${out}/humo-${++shots}.png` });
  }
  await page.waitForTimeout(100);
}
await ptr("pointerup", cx, cy);
console.log(lines.join("\n"));
console.log(JSON.stringify({ derrapes: drifts, miniTurbos: boosts, cargaMax: Math.round(maxCharge), vMax: +maxV.toFixed(1), minY: +minY.toFixed(2), fueraDePista: `${offroad}/${n}`, capturas: shots, errores: errors }, null, 1));
await browser.close();
