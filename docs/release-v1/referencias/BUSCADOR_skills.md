# BUSCADOR_skills — Herramientas para el look de "Derrape"

Fecha: 2026-11-20. Todos los enlaces de abajo se comprobaron con `curl` (HTTP 200) y los comandos se copiaron de los README/docs oficiales, salvo lo marcado como **no verificado**.

Contexto: juego de karts móvil, Three.js + TypeScript, toon shading (`MeshToonMaterial` + `gradientMap`), outline solo en pilotos, fuego aditivo, niebla, cielo degradado, 60 fps.

Nota: no he abierto las 3 imágenes de referencia para esta investigación. Solo he buscado herramientas.

---

## Top 7 (priorizado)

### 1. CloudAI-X/threejs-skills — skill de Three.js actualizado
- Enlace: https://github.com/CloudAI-X/threejs-skills
- Para qué: evita que Claude escriba APIs de Three.js obsoletas. Su README lista cambios entre r160 y r186 (p. ej. `RGBELoader` → `HDRLoader`, `Clock` → `Timer`) y una lista de "errores comunes". Útil para toon, niebla y shaders.
- Instalación: `npx skills add cloudai-x/threejs-skills`
- Gratis: sí (MIT).
- Cautela: la web de los documentos de Three.js ahora recomienda `WebGPURenderer` + TSL para materiales personalizados (según este README). Para móvil con WebGL, decide el renderer a propósito y escríbelo en CLAUDE.md.

### 2. majidmanzarpour/threejs-game-skills — director de juegos Three.js
- Enlace: https://github.com/majidmanzarpour/threejs-game-skills
- Para qué: 9 skills; el "director" (`threejs-game-director`) reparte gameplay, gráficos, UI, depuración y verificación de release.
- Instalación: `npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a claude-code -g -y`
- Gratis: el núcleo sí, sin claves de pago. Los skills de generación externa (Tripo, Gemini, ElevenLabs) necesitan API keys de pago: **no los uses** si quieres cero créditos. El README dice que sin claves continúa con assets procedurales.
- Cautela: repo con poca trayectoria; no he comprobado su calidad ejecutándolo. Revisa los `SKILL.md` antes de instalar.

### 3. Playwright MCP (Microsoft) — capturas y comparación con la referencia
- Enlace: https://github.com/microsoft/playwright-mcp
- Para qué: abre el juego en un navegador, saca capturas y lee la consola, para comparar con `ejemplo1/2/3`.
- Instalación: `claude mcp add playwright npx @playwright/mcp@latest`
- Gratis: sí.
- **No verificado:** que WebGL/Three.js renderice bien en Chromium headless de este entorno (puede requerir flags de GPU por software). Pruébalo con una escena mínima antes de fiarte de él para juzgar el look.
- Alternativa oficial: integración Claude in Chrome (https://code.claude.com/docs/en/chrome). Requiere extensión de Chrome, ventana visible y no funciona en WSL. Su doc menciona "design verification" (comparar con una maqueta).

### 4. Blender MCP (`mcp-for-blender`, antes `blender-mcp`)
- Enlace: https://github.com/ahujasid/blender-mcp
- Para qué: Claude controla Blender para modelar karts redondeados y calaveras chibi, y exportar GLB.
- Instalación (según README): `uvx mcp-for-blender setup` (necesita `uv`; el addon de Blender se instala con `uvx mcp-for-blender install-addon`). Registro manual en Claude Code: `claude mcp add blender uvx mcp-for-blender`
- Gratis: el servidor es MIT y Blender es gratis. El README anuncia una opción "premium" de modelos IA (Meshy, Tripo, Hyper3D, Hunyuan3D) sin tus propias claves: eso es de pago, ignóralo. Poly Haven/Sketchfab/Poly Pizza como fuentes sí aparecen en la lista de funciones; el coste de cada una **no lo he verificado**.
- Cautela: el README sugiere el script `curl ... | sh`; yo preferiría la vía `uvx` o leer el script antes de ejecutarlo.

### 5. Kenney + Quaternius + KayKit — modelos low-poly gratis
- Enlaces: https://kenney.nl · https://quaternius.com · https://www.kaylousberg.com (los tres respondieron 200; `kenney.nl/assets` dio 403 a curl pero la home abre)
- Para qué: props de circuito (árboles muertos, lápidas, vallas, conos), base de kart y calavera para retocar.
- Instalación: descarga manual del pack (no hay comando). Importa GLB con `GLTFLoader`.
- Gratis: sí. Kenney y Quaternius indican CC0 en sus páginas. Una guía que encontré dice que parte de Quaternius es CC-BY: **comprueba la licencia de cada pack**. KayKit: licencia **no verificada**, revísala.

### 6. ambientCG y Poly Haven — texturas y HDRI gratis
- Enlaces: https://ambientcg.com · https://polyhaven.com
- Para qué: texturas de suelo/roca/madera. Para toon úsalas desaturadas o como mapa de detalle. Poly Haven es fotorrealista, así que no sirve para el cielo cartoon salvo como referencia.
- Instalación: descarga manual (o desde Blender MCP, ver nº 4).
- Gratis: sí; ambas muestran CC0 en la página.

### 7. Blender (modelado propio) + generación procedural en código
- Enlace: https://www.blender.org (devolvió 403 a curl, pero es el sitio oficial; **no verificado por curl**).
- Para qué: con el look toon, el kart y la calavera chibi son formas simples (esferas, cápsulas, torus). Modelarlos en código (`SphereGeometry`, `CapsuleGeometry`, `LatheGeometry`) con `MeshToonMaterial` evita assets externos y pesa poco en móvil.
- Instalación: descargar de blender.org, o con el gestor de paquetes de tu sistema. Comando exacto no verificado.
- Gratis: sí (GPL).

---

## Buenas prácticas para /goal y tareas largas (docs oficiales de Claude Code)

Fuentes: https://code.claude.com/docs/en/goal · https://code.claude.com/docs/en/best-practices

- **`/goal`**: `/goal <condición>` mantiene a Claude trabajando; tras cada turno un modelo evaluador comprueba si se cumple. La condición admite hasta 4.000 caracteres. El evaluador **no ejecuta comandos ni lee archivos**: juzga solo lo que Claude muestra en la conversación. Redacta la condición como algo que la salida de Claude pueda demostrar (p. ej. "`pnpm tsc --noEmit` y `pnpm build` terminan con código 0 y adjuntas captura de `/tmp/shot.png`").
- **Permisos**: un goal no cambia el modo de permisos. Para correr sin supervisión, usa modo auto; en modo manual seguirá pidiendo permiso. Para reglas que nunca deben romperse, usa reglas `deny` o hooks (el classifier de modo auto es un juicio, no una regla dura).
- **Modo no interactivo**: `claude -p "/goal ..."` ejecuta el bucle hasta terminar en una sola invocación (documentado en la página de goal).
- **Stop hook (verificación determinista)**: ejemplo oficial en `.claude/settings.json`:
  `{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"pnpm tsc --noEmit 1>&2 || exit 2"}]}]}}`
  Con salida 2 se impide terminar. Si bloquea 8 paradas seguidas sin llamadas a herramientas, Claude Code lo anula (se puede subir con `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`).
- **CLAUDE.md**: son directrices, no garantías; Claude puede decidir que no aplican. Mantenlo corto (la doc dice que si se ignora una regla suele ser por exceso de longitud o ambigüedad). Pon ahí: presupuesto de 60 fps/draw calls, regla "outline solo en pilotos", renderer elegido, rutas de las referencias.
- **Verificación visual**: pide *evidencia* (comando + salida, o captura), no un "ya está". Una buena condición de goal para este proyecto: captura del juego en la misma cámara que `ejemplo*.png` guardada en una ruta fija, más `tsc` y `build` en verde. Un juicio de "se parece a la referencia" lo hace el modelo mirando la imagen: es subjetivo, así que revísalo tú al final.
- **Subagentes**: cada uno tiene contexto limpio; útiles para investigar o revisar sin llenar el contexto principal (https://code.claude.com/docs/en/sub-agents, solo comprobado que responde 200).
- **Coste**: según la doc, un `/loop`, el check del goal y los subagentes siguen enviando peticiones mientras no estás. Pon un límite explícito (p. ej. "o parar tras N intentos y resumir qué falta").

## Descartado / no confirmado
- Plugins "Ralph Wiggum" y otros bucles de la comunidad: solo los vi mencionados en blogs, sin verificar repo ni comando. Con `/goal` nativo no hacen falta.
- `secondsky/claude-skills` (plugin `threejs`): el repo existe (200) y el comando de marketplace es `/plugin marketplace add secondsky/claude-skills` + `/plugin install threejs@claude-skills`; el README dice que está basado en el nº 1. No lo incluyo en el top por solapar.
- No encontré ningún skill o MCP específico para toon shading con `gradientMap` ni para comparación automática de imágenes con una referencia: eso tendrás que cubrirlo con una instrucción en CLAUDE.md y capturas (nº 3).
- No he buscado en Reddit ni en X: solo en búsqueda web general, GitHub y documentación oficial.

---
Fecha: 2026-11-20. Fuentes: GitHub (CloudAI-X/threejs-skills, majidmanzarpour/threejs-game-skills, secondsky/claude-skills, microsoft/playwright-mcp, ahujasid/blender-mcp), code.claude.com/docs (goal, best-practices, chrome), kenney.nl, quaternius.com, ambientcg.com, polyhaven.com, y búsquedas web generales.
