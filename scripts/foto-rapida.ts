// Foto suelta para iterar: npx tsx scripts/foto-rapida.ts <urlBase> <salida.png> <metros,lateral,giro> [personaje] [coche] [espera ms]
import { chromium } from "playwright-core";

const [base = "http://localhost:5173", out = "/tmp/foto.png", foto = "0,0,0", character = "lia", kart = "", espera = "2500"] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
});
// ESCRITORIO=1 → 1280×720 @1x sin táctil (para comprobar el casi negro en pantalla ancha).
const desktop = process.env.ESCRITORIO === "1";
const ctx = await browser.newContext(
  desktop ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
);
await ctx.addInitScript(
  ([c, k]) => {
    const prof = JSON.parse(localStorage.getItem("derrape.profile") ?? "{}");
    prof.character = c;
    if (k) prof.kart = k;
    localStorage.setItem("derrape.profile", JSON.stringify(prof));
  },
  [character, kart],
);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto(`${base}/?track=laguna-de-las-animas&foto=${foto}${process.env.VISTA ? `&vista=${process.env.VISTA}` : ""}`);
await page.waitForFunction(() => (window as unknown as { __escena?: unknown }).__escena, null, { timeout: 60000 });
await page.waitForTimeout(Number(espera));
if (process.env.OCULTAR) {
  await page.evaluate((names) => {
    const { scene } = (window as unknown as { __escena: { scene: { traverse(f: (o: { name: string; visible: boolean }) => void): void } } }).__escena;
    scene.traverse((o) => { if (names.includes(o.name)) o.visible = false; });
  }, process.env.OCULTAR.split(","));
  await page.waitForTimeout(300);
}
await page.addStyleTag({ content: "#countdown, #wrong-way, #loading, #touch-help { display: none !important }" });
const png = await page.screenshot({ path: out });
// Casi negro (V < 8 %) sobre la captura, como en la revisión: HSV con V = max(r,g,b)/255.
const dark = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.max(d[i]!, d[i + 1]!, d[i + 2]!) / 255 < 0.08) n++;
  return (100 * n) / (d.length / 4);
}, png.toString("base64"));
const trees = await page.evaluate(() => {
  const { scene } = (window as unknown as { __escena: { scene: { traverse(f: (o: { name: string; count?: number }) => void): void } } }).__escena;
  let t = 0;
  scene.traverse((o) => { if (o.name.startsWith("arboles-")) t += o.count ?? 0; });
  return t;
});
console.log(`casi negro ${dark.toFixed(2)} % · árboles ${trees}`);
const info = await page.evaluate(() => {
  const e = (window as unknown as { __escena: { renderer: { info: { render: { calls: number; triangles: number } } } } }).__escena;
  return e.renderer.info.render;
});
console.log(out, JSON.stringify(info));
await browser.close();
