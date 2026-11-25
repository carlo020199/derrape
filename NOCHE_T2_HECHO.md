ESTADO: COMPLETO

> «COMPLETO» = los 8 puntos de T2 hechos, verificados y empujados a `origin/release/v1`. No incluye la prueba en iPhone/Android (sigue en `docs/release-v1/PENDIENTE.md`) ni la decisión sobre C7 (ver Bloqueos).

## Qué se ha hecho
Un commit en español por punto, cada uno con `npm test`, `npm run lint` y `npm run build` en verde.
1. **Arco de salida y esfera lisa quitados** de `d = 0` (`animas.ts`). La salida queda despejada hacia la laguna y el campanario.
5. **Asfalto**: Ciruela #1E1830 liso con manchas grandes y suaves en Sombra #2E2547 (3 escalones, ruido de 4–14 m), sin el ruido fino que se leía como estática (`materials.ts`). El terreno no se ha tocado: ya es claramente distinto de la calzada (morado vivo frente a Ciruela). Dalí pedía Sombra/Niebla; lo dejé así porque oscurecerlo restaba el morado dominante (C2). Es una decisión reversible.
6. **Franja bajo el kart**: era la **línea central** del asfalto, no la sombra blob (el blob es un disco de 1,3 m y no puede llegar al borde). Quitada en el tema `animas` (`themes.ts`).
2. **Campanario oscuro**: cuerpo #2E2547, tejado #1E1830; campana y tres ventanas arqueadas por piso en Llama #FFB423 emisiva (una malla `MeshBasicMaterial`); la torre mira a la parrilla (antes miraba a la calzada de al lado y la campana se veía de canto).
3. **Relleno lateral**: árboles instanciados 38 → **58** (3 llamadas), 22 grandes pegados al arcén de la salida (la parrilla está ~9 m sobre el terreno y los de antes quedaban ocultos bajo la calzada). Farolillos con halo: ya eran 30 (10 en los primeros 140 m). Escritorio 1280×720: casi negro **0,8–1,2 %** (< 5 %). `scripts/foto-rapida.ts` mide casi negro y cuenta árboles (`ESCRITORIO=1`).
7. **Cámara**: balanceo con el peralte topado a **8°** (`ROLL_MAX_DEG`, antes 32°), con test.
4. **Nubes toon** (`sky.ts`): opacas, sin prueba de profundidad, bases Sombra y borde Niebla+Ánima encima, ordenadas nubes < colinas < mundo; paleta de Dalí. Adiós a los discos semitransparentes superpuestos y a la sombra tipo «garras» entre puffs. El moteado del asfalto quedó resuelto en el punto 5.
8. **Coleta de Lía de espaldas**: cúpula Espectro clara + banda de nuca oscura con corte nítido + goma Noche (`pilots.ts`). Lía pasó a 5 380 triángulos (límite de test 5 500).

Medidas (`npm run medir`, Laguna): **53 llamadas · 86 082 triángulos** (objetivo ≤ 90 / ≤ 110 000). Peor pareja piloto+coche: 9 802 cerca (≤ 10 000) y 586 lejos (≤ 1 500). `renderer.info` en capturas: 45–61 llamadas, 92–100 k triángulos. Tests: 20 archivos, **191** OK; bot «piloto automático» OK; lint y build con código 0.
Capturas regeneradas (Lía+Hueso y Calavera Chispas+Medianoche) en `docs/release-v1/capturas/` y `docs/screenshots/release1/`; `medidas.json` (`release1.pulidoT2`), `PENDIENTE.md` y `evidencia/EVIDENCIA.md` actualizados con los números nuevos.

## Qué falta
- **Prueba en iPhone y Android** (fps reales, Safari iOS, táctil): pendiente de prueba en dispositivo, igual que antes.
- Decidir la métrica de C7 (ver Bloqueos).
- Revisión de Dalí sobre las capturas nuevas (no he vuelto a puntuar C1–C10 completos: solo las cifras medibles).

## Bloqueos
- **C7 (métrica proxy)**: «región plana contigua» sube de 5,3–6,5 % a **30–34 %** (16–17 % en `d`) porque la calzada es ahora Ciruela plana, que es justo lo que pidió Dalí en el punto 5. T1 había pasado esa métrica añadiendo grano al asfalto. No lo he vuelto a ensuciar para cumplirla. A ojo, los laterales sí están rellenos (árboles, farolillos, colinas, vallas). Hay que decidir si el proxy pasa a medir solo los laterales; consta en `EVIDENCIA.md`.
- **C3 fuera de `d`**: la laguna baja a 0,2–1,6 % en `a`, `b` y `c` (los árboles de la salida tapan algo de agua); `d-laguna` da 8,0 % y 7,4 % (límite 6 %), que es donde se mide.
- La ventana nocturna de esta sesión se cortó antes de ver las capturas con calma; no hay incidencias técnicas.
