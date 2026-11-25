ESTADO: PARCIAL

## Qué se ha hecho
- [x] 1. Arco de salida y esfera lisa quitados de `d = 0` (`animas.ts`).
- [x] 5. Asfalto Ciruela #1E1830 liso con manchas grandes suaves en Sombra #2E2547 (3 escalones), sin ruido fino (`materials.ts`).
- [x] 6. Franja oscura bajo el kart: era la línea central del asfalto (no la sombra blob); eliminada en el tema `animas` (`themes.ts`).
- [x] 2. Campanario oscuro (cuerpo #2E2547, tejado #1E1830) con campana y ventanas Llama emisivas, de cara a la parrilla.
- [x] 7. Balanceo de cámara con el peralte limitado a 8° (`ROLL_MAX_DEG` en `chaseCamera.ts`, con test); también topa el horizonte inclinado.
- [x] 3. Árboles instanciados 38 → 58 (3 modelos, 3 llamadas) con 22 grandes pegados al arcén de la salida (la parrilla está ~9 m sobre el terreno y los de antes quedaban ocultos bajo la calzada); farolillos con halo ya eran 30 (10 en los primeros 140 m). Escritorio 1280×720: casi negro 0,8–1,2 % en salida, curva y laguna (< 5 %). `npm run medir` Laguna: 53 llamadas · 86 082 triángulos. `scripts/foto-rapida.ts` ahora mide casi negro y cuenta árboles (`ESCRITORIO=1`).
- [x] 4. Nubes toon opacas y sin prueba de profundidad (`sky.ts`): ya no hay discos semitransparentes que se mezclen al pisarse; bases Sombra primero y borde Niebla (+toque Ánima) encima, orden de dibujo nubes < colinas < mundo, colores de la paleta. El moteado del asfalto ya quedó sin ruido en el punto 5.
- [x] 8. Coleta de Lía de espaldas (`pilots.ts`): cúpula Espectro clara + banda de nuca oscura (Sombra de Espectro hundida 60 % hacia Noche) con corte nítido, goma Noche entre nudo y cúpula; deja de ser una mancha.

## Qué falta
- Regenerar capturas y `medidas.json`, push a `origin/release/v1`.

## Bloqueos
Ninguno.
