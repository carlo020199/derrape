# Evidencia de los criterios C1–C10 (Release 1)

Todo sale de las capturas 390×844 @2x de `docs/release-v1/capturas/` (Lía + Hueso) y `docs/release-v1/capturas/calavera-chispas/` (Calavera Chispas + Medianoche), con `metricas.json` (`npm run capturas`) y `evidencia.json` (`python3 scripts/evidencia-criterios.py`). Las hojas `hoja-*.png` ponen cada captura junto a `ejemplo1`/`ejemplo2`. Lo que no se puede medir se juzga a ojo y se dice.

| Criterio | Cómo se comprueba | Resultado | Archivo |
|---|---|---|---|
| **C1** Encuadre | Guías dibujadas sobre las capturas: banda del horizonte 25–40 %, centro del kart 60–75 %, kart 30–40 % del ancho (marcas naranjas a ±15 % del centro) | Kart ≈ 37 % del ancho (ruedas a ±18 % del centro), centro ≈ 66 %, horizonte ≈ 38 %, calzada y paisaje por delante > 40 %; techo del kart y cabeza entera visibles (de espaldas). Juicio visual con guías | `c1-guias-*.png` |
| **C2** Color | `metricas.json` | Morado 83,7–93,4 %; casi negro 1,0–1,35 % (límites > 55 % y < 5 %) | `capturas/metricas.json` |
| **C3** Laguna | `metricas.json` (ΔE < 15 a Espectro/degradado) | `d-laguna`: 8,2 % (Lía) y 6,9 % (Chispas); límite 6 % | `capturas/metricas.json` |
| **C4** Cielo | Luna: blob casi blanco del tercio superior; cielo: columna con menos nubes, salto máx. entre filas vecinas | Luna **15,0 % del ancho** (límite 10–16 %), circularidad 0,88–0,90; degradado #3C3354 → #665098 sin bandas (salto ≤ **1/255**). Nubes más claras arriba: juicio visual | `evidencia.json` |
| **C5** Cálidos | Blobs Brasa/Llama (H 18–50°, S > 0,6, V > 0,75, ≥ 40 px) en `b`, sin el botón de objeto ni el tercio inferior | `b`: **5** farolillos/puntos (≥ 4); `a`: 2. Escapes y faros emisivos en el tercio inferior | `evidencia.json` |
| **C6** Bordes | `c-curva-valla`: blobs de hueso con proporción de cráneo, píxeles Espectro y Ánima | **9** postes-calavera con cuerda; línea Espectro (1 515–4 217 px) y bordillo Ánima/Hueso (≈ 58 000 px) | `evidencia.json`, `capturas/c-curva-valla.png` |
| **C7** Relleno lateral | Región plana contigua mayor (σ de luminancia < 0,03 por bloque de 32 px CSS, bloques conectados) en % de la pantalla | **5,3–6,5 %** en las 8 capturas (límite 10 %). Laterales con colinas, árboles, farolillos, laguna y valla (visual) | `capturas/metricas.json` → `c7_regionPlanaMayorPctPantalla` |
| **C8** Pilotos | Test de proporciones (`kartModel.test.ts`) + selección | Cabeza 46,4 % (Lía) y 47,8 % (Chispas) de la altura sentado; coleta Espectro, ojos Llama, Hueso claro con morro de calavera; Medianoche oscuro con faros Llama; contorno Noche visible (visual) | `capturas/seleccion-*.png`, `capturas/calavera-chispas/seleccion-*.png` |
| **C9** Legibilidad | Captura de carrera `e-frontal` (cámara delante del kart, mismo circuito y HUD) a 1× + contraste del HUD | Cuencas y 5 dientes de ambas calaveras y el morro-calavera de Hueso se leen a 1× (se vio un fallo en los dientes de Chispas y se corrigió). Contraste HUD: **14,1:1** (pastilla) y **17,7:1** (números con trazo Noche); mínimo 4,5:1. Juicio visual con recortes | `c9-frontal-1x-*.png`, `c9-frontal-zoom-*.png` |
| **C10** Técnico | `npm run medir` y tests | Laguna 55 llamadas / 85 518 triángulos (≤ 120 / 150 000, y objetivo ≤ 90 / 110 000); 188 tests en verde | `medidas.json` |

Notas honestas:
- Los criterios marcados «visual» los juzga una persona (aquí, quien escribe el informe) mirando las imágenes; los recortes y guías están para repetir el juicio.
- Al medir se encontraron y corrigieron dos desajustes: la luna medía 16,5 % (ahora 15,0 %) y los dientes de Calavera Chispas quedaban enterrados en el cráneo.
- C9 en carrera normal (cámara detrás) solo muestra las calaveras de las vallas; la cara de los pilotos se demuestra con `e-frontal`.
- Los fps reales en iPhone/Android siguen pendientes (`../PENDIENTE.md`).
