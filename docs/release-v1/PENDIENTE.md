# Release 1 · Pendiente de prueba en dispositivo

> **Pendiente de prueba en dispositivo.** Lo que sigue no se puede confirmar en el box (sin iPhone ni Android, sin Safari iOS, sin táctil real). Solo hay métricas proxy.

## Qué probar y cómo
URL (cliente en local, misma Wi-Fi que el móvil): `http://IP-DEL-PC:5173/?track=laguna-de-las-animas`
(arrancar con `npm run dev:host`). Render solo despliega `main`, así que hasta fusionar el PR no hay URL pública.

1. **iPhone (Safari) y Android (Chrome)**: abrir la URL, entrar a «Piloto y coche» y elegir *Lía Brasas* (coche Hueso) y *Calavera Chispas* (coche Medianoche). Comprobar que el piloto, el pedestal con el foco cálido y las filas horizontales caben sin cortes, y que el botón **Listo** queda fijo abajo.
2. **Carrera en la Laguna de las Ánimas** (vertical): conducir una vuelta entera con cada pareja.
   - **60 fps sostenidos**: activar el contador (⚙ Ajustes → «Mostrar fps») y mirar la salida, la zona de vallas (≈ metros 700–900) y la zona de la laguna (≈ metros 150–300).
   - Fuego de escapes, turbo Espectro al derrapar, halo de los faros de Medianoche.
   - La coleta de Lía se balancea; el piloto se inclina al girar; rebote al coger turbo; brazos arriba al cruzar meta.
3. **Táctil real**: giro, derrape y botón de objeto (ahora a la derecha, a media altura) con los pulgares; comprobar que el botón de ajustes (bajo la pastilla de vuelta) no estorba.
4. **Calor / batería**: 5 minutos seguidos en iPhone de hace 3–4 años; si baja de 50 fps, anotar el modelo.
5. Si algo va justo, bajar primero `pixelRatio` (ya ≤ 2) o las vallas (`createFences`, `maxPosts` en `animasProps.ts`) y el terreno (rejilla 100×100 en `animas.ts`).

## Métricas proxy medidas en el box (WebGL por software, no representativas de un móvil)
| Qué | Valor | Presupuesto |
|---|---|---|
| `npm run medir` · Laguna (8 karts, cámara vertical) | 53 llamadas · 86 082 triángulos | ≤ 90 y ≤ 110 000 (duro 120 / 150 000) |
| `renderer.info` en las capturas (4 karts) | 45–61 llamadas · 92 000–100 000 triángulos | ≤ 90 y ≤ 110 000 |
| Piloto + coche de cerca (peor pareja, sin contorno) | 9 802 (Lía + Medianoche) | ≤ 10 000 |
| Piloto + coche lejos (modelo barato) | 586 | ≤ 1 500 |
| ms/fotograma por software (SwiftShader, 390×844 @2x) | 38–57 ms | solo orientativo |
| Peor circuito del juego | Viñedos, 36 llamadas · 100 152 triángulos | ≤ 120 y ≤ 150 000 |

Detalle en `medidas.json` (campos `limites` y `release1`) y en `docs/release-v1/capturas/metricas.json`.

## Verificación (V1–V6) y criterios C1–C10
La evidencia criterio por criterio (medidas, guías y recortes @1×) está en **`docs/release-v1/evidencia/EVIDENCIA.md`**. Resumen:

| Criterio | Resultado | Evidencia clave |
|---|---|---|
| C1 Encuadre | Pasa | Kart ≈ 37 % del ancho, centro ≈ 66 %, horizonte ≈ 38 % (guías en `evidencia/c1-guias-*.png`; juicio visual) |
| C2 Color | Pasa | Morado 83,3–94,5 %, casi negro ≤ 1,65 % (escritorio: 0,8–1,2 %) |
| C3 Laguna | Pasa | `d-laguna`: 8,0 % (Lía) y 7,4 % (Chispas) |
| C4 Cielo | Pasa | Luna 14,7–14,9 % del ancho, circular; degradado con salto ≤ 1/255 entre filas |
| C5 Cálidos | Pasa | 5 puntos Brasa/Llama en `b` (≥ 4) |
| C6 Bordes | Pasa | 11 postes-calavera con cuerda, línea Espectro y bordillo Ánima/Hueso |
| C7 Relleno lateral | Pasa a ojo; **la métrica proxy ya no pasa** | Región plana contigua 30–34 % (16–17 % en `d`) porque la calzada es ahora Ciruela plana por petición de Dalí; 58 árboles, farolillos con halo y colinas en los laterales. Decide Carlo/Dalí qué métrica vale |
| C8 Pilotos | Pasa | Cabeza 46,4 % / 47,8 % de la altura sentado (test); colores y contorno en las selecciones |
| C9 Legibilidad | Pasa | Captura `e-frontal` a 1× (cuencas y 5 dientes de ambas calaveras, morro de Hueso) y contraste HUD 14,1:1 y 17,7:1. En carrera normal la cámara va detrás: solo se ven las calaveras de las vallas |
| C10 Técnico | Pasa | 53 llamadas / 86 082 triángulos; 191 tests |

Veredicto (GOAL: C1, C2, C3, C7, C8, C10 y al menos 3 de C4/C5/C6/C9): **PASA**, con los cuatro opcionales.

## No verificado / fuera de alcance
- Safari iOS (WebGL, `pixelRatio`, PWA) y táctil real.
- Multijugador online con los dos pilotos nuevos (la lógica de red no se ha tocado; el servidor acepta el id `calavera-chispas` y el coche `medianoche`/`hueso` por el catálogo compartido, con tests).
- Los otros circuitos no se han tocado, **salvo Ribera de las Ánimas**, que comparte el tema `animas` y recibe el mismo paisaje (terreno, árboles, farolillos y vallas).

## Propuesta (sin aplicar): cómo medir C7 solo en los laterales
**Problema.** `c7_regionPlanaMayorPctPantalla` cuenta bloques de 64 px con σ de luminancia < 0,03 y toma la región conectada mayor de *toda* la pantalla bajo el 40 % de alto. Desde que la calzada es Ciruela plana (pedido de Dalí, punto 5), esa región es el asfalto (30–34 %; 16–17 % en `d`), no un lateral vacío. C7 habla de los laterales, no de la calzada.

**Probado en el box (prototipo en Python sobre las capturas ya hechas, no entra en el repo).** Recortar solo las franjas laterales (x < 30 % y x > 70 %, desde el 40 % de alto hasta encima del minimapa) **no basta**: abajo el asfalto entra en las esquinas y da 53–71 % de bloques planos y una región mayor del 23–40 % de la franja. Hace falta quitar la calzada de la medida.

**Opciones, de más a menos robusta:**
1. **Máscara por render (recomendada).** `capturas-release.ts` hace una segunda captura de la misma toma con `?mascara=1`: calzada y bordillos en magenta plano, kart/piloto en otro color y sin HUD (`MeshBasicMaterial` con `onBeforeCompile` o `scene.overrideMaterial` por capas). C7 = región plana mayor entre los píxeles que **no** son calzada, kart, cielo ni HUD, en % de esa área. Es exacto, cuesta ~20 líneas en el script y ~5 en `raceSession.ts` bajo el flag (sin tocar el render normal).
2. **Máscara por color (sin tocar el cliente).** Excluir bloques cuya media está a ΔE < 8 de Ciruela `#1E1830` / Sombra `#2E2547` *y* cuyo centro cae dentro de la calzada proyectada. Más frágil: el morado del terreno y la calzada son parientes.
3. **Máscara geométrica.** Proyectar en el script el borde de la calzada con la cámara de la toma (`?foto=`) y descartar lo de dentro. Exacto pero acopla el script a la cámara.

**Umbral sugerido.** Región plana mayor ≤ 10 % del área lateral visible (el 10 % de Dalí, ahora sobre el área correcta), más el recuento de objetos (≥ 4 árboles o vallas visibles por lado) que ya mide `scripts/foto-rapida.ts` con `ESCRITORIO=1`.

**Qué decidir (Carlo/Dalí).** Si vale la opción 1 y el umbral anterior. Hasta entonces C7 sigue «pasa a ojo; el proxy antiguo no aplica». No se ha tocado el script ni la escena.

## Árboles de salida y agua visible (C3 fuera de `d`)
Medido quitando los árboles (flag temporal, ya revertido): `a` 0,91 → 2,02 %, `b` 1,57 → 1,85 %, `c` 0,53 → 0,52 %, `d` 7,98 → 7,97 %. Los árboles tapan como mucho ~1 punto; el agua no se ve en `a`–`c` porque la calzada elevada y la cresta la ocultan, no por los árboles. Se dejan como están: C3 se mide en `d` (8,0 % / 7,4 %).
