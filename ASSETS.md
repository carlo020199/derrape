# Assets

Solo assets CC0 o propios, en `apps/client/public/assets`. Cada uno, anotado aquí.

| Archivo | Origen (URL) | Autor | Licencia | Cambios |
|---|---|---|---|---|

Los 8 personajes y los 10 coches son modelos propios hechos con primitivas de Three.js en `apps/client/src/render/kartModel.ts` (sin assets externos). Las imágenes de concepto no entran en el juego.

Los 10 circuitos y sus kits de tema (`apps/client/src/render/themes.ts`) usan solo primitivas low-poly generadas en código (sin packs externos).

El audio de la Fase 9 (`apps/client/src/audio/sfx.ts`) es sonido sintético propio con Web Audio API (sin archivos de audio).

Fuentes de la interfaz, alojadas en `apps/client/public/fonts/` para que la PWA funcione sin red. Las dos son de Google Fonts, SIL Open Font License 1.1 (el texto está junto al archivo):

| Archivo | Origen | Licencia | Uso |
|---|---|---|---|
| `fonts/lilita-one-latin.woff2` | [Lilita One](https://fonts.google.com/specimen/Lilita+One) | OFL (`fonts/LilitaOne-OFL.txt`) | Títulos y números |
| `fonts/nunito-latin.woff2` | [Nunito](https://fonts.google.com/specimen/Nunito) (variable, pesos 600–900, subconjunto latino) | OFL (`fonts/Nunito-OFL.txt`) | Texto de la interfaz |
