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
| `npm run medir` · Laguna (8 karts, cámara vertical) | 55 llamadas · 85 518 triángulos | ≤ 90 y ≤ 110 000 (duro 120 / 150 000) |
| `renderer.info` en las capturas (4 karts) | 53–65 llamadas · 95 000–103 000 triángulos | ≤ 90 y ≤ 110 000 |
| Piloto + coche de cerca (peor pareja, sin contorno) | 9 754 (Lía + Medianoche) | ≤ 10 000 |
| Piloto + coche lejos (modelo barato) | 586 | ≤ 1 500 |
| ms/fotograma por software (SwiftShader, 390×844 @2x) | 42–60 ms | solo orientativo |
| Peor circuito del juego | Viñedos, 36 llamadas · 100 152 triángulos | ≤ 120 y ≤ 150 000 |

Detalle en `medidas.json` (campos `limites` y `release1`) y en `docs/release-v1/capturas/metricas.json`.

## Verificación (V1–V6) y criterios C1–C10
Ver `NOCHE_T1_HECHO.md` y la sección siguiente. Resumen del juicio sobre las capturas (`docs/release-v1/capturas/`, copiadas a `docs/screenshots/release1/`):

| Criterio | Resultado | Evidencia |
|---|---|---|
| C1 Encuadre | Pasa | Kart ≈ 37 % del ancho, centro ≈ 66 % de la altura, horizonte ≈ 38 %, calzada y paisaje delante > 40 %; se ve el techo del kart y la cabeza entera (de espaldas) |
| C2 Color | Pasa | Morado 83–94 %, casi negro 1–1,4 % (`metricas.json`) |
| C3 Laguna | Pasa | `d-laguna`: 8,2 % (Lía) y 6,9 % (Calavera Chispas); `a`/`b` ≈ 2 % (franja lejana) |
| C4 Cielo | Pasa | Luna circular ≈ 15 % del ancho, degradado Ciruela→Niebla, nubes más claras arriba |
| C5 Cálidos | Pasa | ≥ 4 farolillos/puntos Brasa–Llama en `a` y `b`; escapes y faros emisivos |
| C6 Bordes | Pasa | `c-curva-valla`: > 8 postes-calavera con cuerda, bordillo Ánima/Hueso, línea Espectro |
| C7 Relleno lateral | Pasa | Laterales con colinas, árboles, farolillos, laguna y valla. La calzada tiene textura de asfalto gastado (moteado + grano): `metricas.json` → `c7_bloquesPlanosRelativoPct` (σ/media < 3 % por bloque) = 3,7–5,7 % en `a`/`b`/`c` y 11–12,5 % en `d`, es decir, ninguna región plana > 10 % salvo el margen en `d`. El indicador absoluto `c7_bloquesPlanos…` (σ de luminancia < 0,03) sigue en 38–56 %: con un asfalto de luminancia ≈ 0,2 es inalcanzable sin ruido exagerado y el GOAL lo marca como solo orientativo |
| C8 Pilotos | Pasa | Cabeza 46,4 % (Lía) y 47,8 % (Chispas) de la altura sentado (test); coleta Espectro y ojos Llama; Hueso claro con morro de calavera; Medianoche oscuro con faros Llama; contorno Noche visible |
| C9 Legibilidad | **Parcial** | Dientes y cuencas se leen en la selección y en los postes de valla; en carrera el piloto va de espaldas, así que su cara no se ve |
| C10 Técnico | Pasa | Ver tabla de arriba |

Veredicto (GOAL: C1, C2, C3, C7, C8, C10 y al menos 3 de C4/C5/C6/C9): **PASA** — cumple C1, C2, C3, C7, C8 y C10, y de C4/C5/C6/C9 cumple C4, C5 y C6 (C9 es parcial). Carlo puede decidir si quiere más textura en la calzada (ver «Decisiones» en `NOCHE_T1_HECHO.md`).

## No verificado / fuera de alcance
- Safari iOS (WebGL, `pixelRatio`, PWA) y táctil real.
- Multijugador online con los dos pilotos nuevos (la lógica de red no se ha tocado; el servidor acepta el id `calavera-chispas` y el coche `medianoche`/`hueso` por el catálogo compartido, con tests).
- Los otros circuitos no se han tocado, **salvo Ribera de las Ánimas**, que comparte el tema `animas` y recibe el mismo paisaje (terreno, árboles, farolillos y vallas).
