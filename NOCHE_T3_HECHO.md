ESTADO: BLOQUEADO

## Qué se ha hecho
- Intento de la parte Hydrogen: 3 llamadas a `gemini-4-hydrogen`, las 3 fallan con 429 (cuota diaria gratuita de 20 peticiones agotada; reinicio en ~9 h 47 min, ~09:00).
- Documentado en `docs/release-v1/HYDROGEN_vs_referencias.md`.
- **No se ha tocado código**: sin la lista de diferencias de Hydrogen no hay «3 primeras» que aplicar, y no quise improvisar cambios visuales a ojo. Tests, lint, build y medidas siguen como al cierre de T2 (191 tests, Laguna 53 llamadas · 86 082 tris).

## Archivos producidos (rutas absolutas)
- /workspace/derrape-release/docs/release-v1/HYDROGEN_vs_referencias.md
- /workspace/derrape-release/NOCHE_T3_HECHO.md

## Qué falta
- Pasar las capturas (`a`–`e`, selección) por Hydrogen cuando haya cuota (la tabla de uso se repone ~09:00 del 26-11 o más tarde).
- Aplicar las 3 primeras diferencias compatibles con Dalí/T2, con test+lint+build+medir+captura tras cada una, y repetir Hydrogen al final.

## Cómo comprobarlo
- `cd /workspace/derrape-release && gemini -m gemini-4-hydrogen -p "Describe @docs/screenshots/release1/a-salida.png"` → 429 mientras no se reponga la cuota.

## Bloqueos
- Cuota diaria de Hydrogen agotada (429, `limit: 20`). Probablemente se gastó en las pasadas anteriores del día. Esperar no cabe en la ventana.

## Decisiones para Carlo
- ¿Reintentar mañana tras la reposición de cuota, o prefieres que Claude puntúe C1–C10 a ojo con las capturas y las referencias (gasta límite de Claude, que querías ahorrar)?
- Para ahorrar cuota: una sola llamada con 3–4 capturas en el mismo prompt en vez de una por captura.
