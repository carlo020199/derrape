# GOAL del Release 1

Texto exacto para `/goal` (3 400 caracteres aprox.; el límite de `/goal` es 4 000). Cópialo tal cual, desde la línea de abajo hasta el cierre del bloque.
Se lanza en esta rama (`release/v1`), con permisos en modo auto o similar. El evaluador solo ve la conversación: por eso cada criterio pide mostrar la salida del comando o la captura.
`.claude/settings.json` deniega `git push`/`merge` y tiene un hook de `Stop` que ejecuta `npm run lint`.

```
Release 1 de Derrape en la rama release/v1: 2 pilotos con su kart (Lía Brasas y Calavera Chispas; coches Hueso y Medianoche) y 1 circuito (Laguna de las Ánimas) con el aspecto de docs/release-v1/referencias (ejemplo1, ejemplo2, ejemplo3), a 60 fps en móvil. Lee antes CLAUDE.md «Release 1» y docs/release-v1/referencias/DALI_direccion_arte.md (paleta, modelos, C1-C10). Reglas: NO git push ni merge a main; commits en español, uno por fase; no tocar otros circuitos ni personajes salvo lo necesario; solo hex de la paleta; outline solo en pilotos y karts; MeshToonMaterial con gradientMap de 3 escalones.

FASES (cada una termina con npm test, npm run build y npm run lint en verde + commit + casilla en docs/PLAN.md):
1. Base: paleta, Lilita One/Nunito y CSS de HUD/menús (style.css, index.html).
2. Laguna: cielo en degradado con luna, niebla #4A3F66 (40-180 m), terreno con colinas, laguna espectral, árboles, farolillos, vallas de hueso, bordillo con línea Espectro, campanario.
3. Fuego: escapes con sprites aditivos, chispas, turbo Espectro.
4. Pilotos y coches: Lía + Hueso, Calavera Chispas + Medianoche (datos en characters.ts/karts.ts, modelos en kartModel.ts), animaciones mínimas, selección sobre pedestal. Actualiza los tests de catálogo y docs/CONTENIDO.md.
5. Pulido y rendimiento; actualiza medidas.json (limites + entrada release1).

VERIFICACIÓN (muestra la salida en la conversación; no basta con decir «ya está»):
- V1 npm test, npm run build y npm run lint terminan con código 0 (pega las últimas líneas y el código de salida).
- V2 Bot: npx vitest run packages/shared/src/race.test.ts -t "piloto automático" pasa.
- V3 Rendimiento: npm run medir da para laguna-de-las-animas ≤ 90 llamadas y ≤ 110000 triángulos (límite duro 120 y 150000); piloto+coche cerca ≤ 10000 triángulos y lejos ≤ 1500. Pega la fila de la Laguna. Las capturas dan además renderer.info en metricas.json.
- V4 Capturas: con npm run dev -w @derrape/client en marcha, ejecuta npm run capturas -- http://localhost:5173 docs/release-v1/capturas lia y otra vez con calavera-chispas. Genera 390×844 @2x: a-salida, b-recta-campanario, c-curva-valla, d-laguna, seleccion-<id> y las hoja-* junto a ejemplo1/ejemplo2, más metricas.json. Ajusta SHOTS si una captura no muestra lo que dice su nombre. Abre las imágenes y las hojas y juzga C1-C10 uno por uno (cita el número y la evidencia).
- V5 Criterios (DALI sección 3): C2 morado > 55 % y casi negro < 5 % y C3 laguna ≥ 6 % salen de metricas.json (c2_*, c3_*); C1, C4-C9 los juzgas mirando las capturas; c7 de metricas.json es solo orientativo. PASA si cumple C1, C2, C3, C7, C8, C10 y al menos 3 de C4, C5, C6, C9. Si falla algo, repite SOLO los criterios fallidos, citándolos por número.
- V6 git status limpio, todo commiteado en release/v1, sin push.

NO VERIFICABLE EN EL BOX: fps reales en iPhone/Android, Safari iOS y táctil real. No lo des por cumplido: deja las métricas proxy (V3, ms/fotograma por software) y escribe en docs/release-v1/PENDIENTE.md «pendiente de prueba en dispositivo» con la URL y los pasos para que Carlo lo pruebe.

PARADA: termina cuando V1-V6 estén demostrados y PENDIENTE.md exista; entonces resume cambios, números medidos y qué queda en manos de Carlo. Para también tras 3 tandas de arreglos sobre los mismos criterios fallidos o si algo requiere cuentas, claves, pagos o push: resume qué falta, qué intentaste y qué decide Carlo.
```

## Notas para quien lo lance
- `npm run capturas` necesita Chrome en `/usr/bin/google-chrome` (o `CHROME_PATH`); `playwright-core` ya es devDependency y no descarga navegadores.
- Si `npm run dev -w @derrape/client` no se queda en segundo plano, lánzalo con `&` y guarda el PID; no uses `pkill -f vite` (mata también la shell que lo contiene).
- El «C7» de `metricas.json` (bloques planos) es aproximado: el estilo toon da muchos bloques de poca varianza; no es un criterio automático.
- Medidas de partida (sin tocar nada): Laguna 52 llamadas / ~71 700 triángulos con `npm run medir`; en las capturas por software, 37–44 llamadas y ~70–76k triángulos.
