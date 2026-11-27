ESTADO: COMPLETO

# Fase 5 — Asfalto pintado decorativo rosa y morado (Desván de las Maravillas)

Rama `circuito/nuevo`. Fase anterior: `FASE4_HECHO.md`.

## Qué se ha hecho
- **Dos escapatorias de asfalto pintado**, solo decoración (como los logos de patrocinadores de las escapatorias de F1). No son zona de juego: no hay ningún `ZoneType` nuevo, `surfaceAt` no cambia y están fuera del muro.
  - **Rosa**: triángulo de ≈ 45 m de lado en el interior de la curva grande G (1.200–1.440 m desde meta).
  - **Morada**: trapecio de ≈ 33 × 21 m entre la diagonal F / horquilla y la recta inferior H.
  - Ambas están en los huecos interiores del sur, donde el `LAYOUT_preview.png` coloca «rosa» y «morada» (lectura A del plan). Se han mantenido a ≥ 17 m del eje (el muro está a 14 m).
- **Datos**: `PaintedAreaDef` (`tracks/types.ts`) y `TrackDef.paint?` (polígono convexo en coordenadas del mundo). El Desván declara sus dos zonas; ningún otro circuito cambia.
- **Render** (`apps/client/src/render/paintedAsphalt.ts`): una sola malla (`asfalto-pintado`) = losas planas por abanico + faldón de 0,6 m (para que de lado no parezca papel flotando sobre el vacío) con **una textura canvas de 1024×576** (ficha rosa, ficha morada y una tira de muestras lisas para el faldón). **1 llamada de dibujo**, ≈ 40 triángulos.
  - Motivos de fantasía, en código: estrellas, setas con lunares, calaveritas simpáticas (ojos grandes y sonrisa) y dos logos inventados por zona: «SETAS MIL», «PAN DE LUNA» (rosa), «CHISPA-COLA», «DON CALAVERA» (morada). Borde pintado y línea discontinua interior.
  - La disposición (`layoutMotifs`) es determinista y pura (sin Three.js ni DOM): logos en los puntos más despejados y adornos en el resto, siempre dentro del polígono. La ficha se orienta según el lado más largo para que el texto se lea sin espejo.
  - Colores solo de la paleta del juego: Ciruela, Ánima / Ánima profunda (morado), el rosa `#ff5fa2` de las cenefas de la Feria (mezclado con Ciruela), Texto y Hueso. Ningún azul Espectro ni naranja/amarillo de turbo.
- `scripts/medir-escena.ts`: el canvas simulado ahora acepta cualquier método de dibujo (proxy no-op), si no `npm run medir` fallaba al montar la textura en Node.
- `scripts/smoke-circuito.ts`: carpeta de salida `fase5`, 6 capturas nuevas (31–36) y modo `SOLO_CAPTURAS=1` para ajustar vistas sin la práctica completa.
- Docs: casilla «CN·Fase 5» en `docs/PLAN.md` y fila 13 de `docs/CONTENIDO.md`.
- **No se ha tocado**: física, `surfaceAt`, cámara, control del dedo, cohete, red/servidor, otros circuitos.

## Resultados de tests / lint / build / smoke / medir
- `npm test`: **27 archivos, 280 tests en verde** (antes 26 / 274). Nuevo `apps/client/src/render/paintedAsphalt.test.ts` (6): dos zonas (rosa y morada) a > 16,5 m del eje (muro + 2,5 m) muestreando vértices, aristas y relleno; con o sin `paint` las zonas y la longitud de la pista son idénticas y `surfaceAt` bajo las losas da lo mismo (la calzada sigue siendo `road`); la losa queda bajo el asfalto cercano; geometría < 100 triángulos con UV dentro del atlas; ≥ 2 logos y ≥ 4 adornos de ≥ 3 clases por zona, dentro del polígono y deterministas; la Laguna no pinta nada.
- `npm run lint`: limpio. `npm run build`: limpio.
- **Smoke Playwright 390×844 @2x** (`npx tsx scripts/smoke-circuito.ts http://localhost:5173`, con `npm run dev` —cliente y servidor— levantado y cerrado después; Chrome del sistema, WebGL por software): **0 errores de consola**, código de salida 0. Práctica en solitario: 115 muestras, 140 km/h máx.; raíl triturbo 78,0 m/s; cadena de 3 S, plataforma, XL de la diagonal y caída con reaparición: todo como en la fase 4 (siguen pasando las comprobaciones del smoke).
- `npm run medir` (8 karts, 390×844): **Desván 41 llamadas, 38 906 triángulos** (igual que en la fase 4: desde la parrilla las zonas pintadas quedan fuera del frustum). Límite: ≤ 90 llamadas y ≤ 110 000 triángulos. Con las zonas a la vista (smoke, con karts y HUD): 18–47 llamadas y 33 659–50 471 triángulos; la malla pintada suma **1 llamada y ≈ 40 triángulos**. Otros circuitos sin cambios (no usan `paint`).
- Fps reales en iPhone: **pendiente de prueba en dispositivo** (textura de 1024×576 y 1 llamada; coste esperado despreciable).

## Capturas (390×844 @2x)
En `/workspace/derrape-circuito-capturas/fase5/`:
- `/workspace/derrape-circuito-capturas/fase5/31-rosa-cenital.png` (la zona rosa desde arriba)
- `/workspace/derrape-circuito-capturas/fase5/32-morada-cenital.png` (la morada desde arriba)
- `/workspace/derrape-circuito-capturas/fase5/35-rosa-lateral.png`, `/workspace/derrape-circuito-capturas/fase5/36-morada-lateral.png` (vistas libres en perspectiva, se ve el faldón)
- `/workspace/derrape-circuito-capturas/fase5/33-rosa-desde-pista.png`, `/workspace/derrape-circuito-capturas/fase5/34-morada-desde-pista.png` (cámara de carrera en la curva G y la diagonal F)
- `/workspace/derrape-circuito-capturas/fase5/07-vista-general.png` (circuito entero con las zonas)
- Anteriores regeneradas: `01`–`30` y `smoke.json`.

## Decisiones tomadas
- **Zonas fuera del muro, en el vacío interior**: el interior del Desván es un plano oscuro a −12 m y la pista está a 0–3 m, así que las zonas son losas planas con faldón a la altura del asfalto cercano (−0,1 m), no calcomanías sobre un suelo que no existe. Se ven desde la pista y no se pueden pisar (el muro de la pista queda entre medias).
- **Trapecio morado más pequeño que el del boceto** (33 × 21 m): el hueco real entre la diagonal F y la recta H solo deja ≈ 24 m de ancho libre con 17 m de margen al eje; por eso el test exige > 16,5 m.
- **Un solo atlas de textura** con ficha por zona en vez de dos materiales: 1 llamada de dibujo.
- La losa morada cae en el rango lateral de las zonas `fall` de la plataforma (±40 m): es preexistente y irrelevante, porque ahí no se puede llegar. El test compara con la pista sin `paint`.
- Texto en «Lilita One» si está cargada y, si no, Impact / Arial Black; los logos son nombres inventados, sin marcas reales.

## Qué falta
- Probar en iPhone real cómo se ven desde la cámara de carrera: en la curva G la zona rosa queda tras el muro y casi no se distingue desde la calzada (se ve mejor desde la diagonal y en la vista general). Si Carlo quiere que se vean más, se pueden acercar al muro o subir 0,3 m.
- Confirmar con Carlo la lectura de «rosa/morada» (hay una pregunta abierta en `PLAN.md` §6): si en realidad son sectores o un atajo, esta fase se queda como adorno.
- Fases siguientes: cohete v2, arte de muebles, pulido.

## Cómo probarlo
1. `npm run dev` y abre `http://localhost:5173/?track=desvan-de-las-maravillas`; las zonas se ven al fondo de la diagonal F y en la curva G / recta H.
2. Vista directa del rosa: `&foto=0,0,0&vista=-119,70,-165,-119,0,-199`; del morado: `&foto=0,0,0&vista=39,55,-195,39,0,-231`.
3. Tests: `npx vitest run apps/client/src/render/paintedAsphalt.test.ts`; todo: `npm test`, `npm run lint`, `npm run build`, `npm run medir`.
4. Smoke: con `npm run dev` en marcha, `npx tsx scripts/smoke-circuito.ts http://localhost:5173` (solo capturas: `SOLO_CAPTURAS=1`).
