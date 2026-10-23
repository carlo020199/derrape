# Derrape — Plan del proyecto

## 1. Objetivo
Un juego de karts propio para echar carreras con los amigos desde el móvil, con iPhone y Android
en la misma partida, sin depender de ninguna tienda de apps.

**Versión 1.0 (la que jugaréis):** **10 circuitos, 5 personajes y 10 coches** disponibles desde el
principio, partidas de 2 a 8 amigos con código de sala, derrapes con turbo y objetos.
Catálogo completo en `docs/CONTENIDO.md`.

## 2. Decisión clave: juego web (PWA), no app nativa

| Opción | iPhone + Android juntos | Coste | Complicación |
|---|---|---|---|
| **Web / PWA (elegida)** | Sí, mismo código y enlace | Hosting gratis o casi | Baja |
| Godot / Unity nativo | Sí, pero dos builds | Cuenta de Apple (~99 $/año) + Google (~25 $ una vez) | **Para compilar para iPhone hace falta un Mac** |
| Capacitor (envolver la web) | Sí | Igual que nativo | Opción futura si algún día lo quieres en las tiendas |

Con la web: mandas un enlace por WhatsApp, lo abren y juegan. En iPhone, "Compartir → Añadir a
pantalla de inicio" lo abre a pantalla completa como si fuera una app.

## 3. Diseño del juego

### Controles (móvil, en vertical, estilo karts de móvil)
- **Acelerar siempre automático.** No hay botón de gas ni de freno.
- **Un dedo en cualquier parte de la pantalla:**
  - arrastrar a izquierda/derecha = girar (proporcional a lo que arrastras);
  - arrastrar lejos hacia un lado = **derrapar** en esa dirección; mientras mantienes el dedo
    el derrape sigue y cargas chispas; al **levantar el dedo**, mini-turbo.
- **Objetos:** tocar = usar; **deslizar hacia arriba = lanzar adelante**; **deslizar hacia abajo = lanzar atrás**.
  Con un segundo dedo también se pueden usar mientras el primero gira.
- **Opcional:** girar inclinando el móvil (giroscopio). En iPhone exige pedir permiso con un toque
  y servir la web por HTTPS.
- Teclado en PC para desarrollar y probar rápido.

### Conducción
- Física arcade: agarre alto, velocidad punta clara, choques suaves que rebotan sin frenar del todo.
- **Derrape con turbo:** arrastrar lejos al girar (Espacio en PC) → chispas nivel 1 → 2 → 3 según el tiempo →
  al soltar, mini-turbo proporcional.
- **Turbo de salida:** acelerar en el momento justo de la cuenta atrás.
- Rampas y saltos (los usan varios circuitos).

### Personajes y coches
- 5 personajes (ligero / medio / pesado) y 10 coches con estadísticas distintas → 50 combinaciones.
- Pantalla de selección: personaje → coche (con barras de estadísticas) → color.
- Detalle en `docs/CONTENIDO.md`.

### Objetos (4, todos originales)
| Objeto | Efecto |
|---|---|
| **Nitro** | Acelerón de 1,5 s |
| **Mancha de aceite** | Se deja detrás; quien la pisa trompea 1 s |
| **Cohete** | Persigue al kart de delante; al impactar, trompo |
| **Escudo** | Bloquea un golpe durante 8 s |

Reparto según posición: los últimos reciben objetos mejores (así nadie se descuelga).
Ideas para después: muelle (salto), bomba de humo, imán que te engancha al de delante.

### Circuitos
- 10 circuitos en 2 copas (Copa Sol y Copa Luna), cada uno con su tema y su mecánica propia.
- Definidos como datos (spline 3D + decoración por kit de tema), así añadir uno no exige programar de cero.

### Modos
1. **Carrera libre multijugador:** el anfitrión elige circuito (o "aleatorio").
2. **Copa multijugador:** 5 circuitos seguidos con puntos y podio final.
3. Contrarreloj en solitario con fantasma de tu mejor vuelta (después de la 1.0).
4. Bots para rellenar huecos y practicar (después de la 1.0).

### Lobby
Crear sala → código de 4 letras + botón "Invitar" (comparte enlace por WhatsApp) → los amigos
entran → eligen personaje, coche y color → el anfitrión elige circuito o copa y pulsa EMPEZAR.
Si alguien pierde conexión, puede volver a la carrera en curso.

### Estilo visual
Low-poly colorido, sombras sencillas, sin post-procesado pesado. Assets gratuitos CC0 como base:
- Kenney.nl (packs de coches, karts y circuitos)
- Quaternius (personajes, animales y escenarios low-poly)

## 4. Arquitectura
Resumen (detalle en `CLAUDE.md`):
- Cliente web (Three.js) ↔ WebSocket ↔ servidor Colyseus.
- Cada móvil simula su kart; el servidor manda en salas, objetos, impactos, vueltas y resultados.
- Simulación del kart en `packages/shared` para poder testearla sin pantalla.
- Personajes, coches y circuitos son **datos** en `packages/shared` (no código suelto por todas partes).

## 5. Particularidades de móvil (checklist)
- [x] iOS no permite bloquear la orientación en el navegador → aviso "pon el móvil en vertical".
- [x] Pantalla completa real en iPhone solo como PWA (añadida a inicio) → manifest + iconos.
- [ ] Audio: se desbloquea en el primer toque del usuario.
- [x] Giroscopio en iOS: pedir permiso tras un toque y solo con HTTPS.
- [ ] Vibración: funciona en Android, no en iPhone (no depender de ella).
- [x] Muesca / isla dinámica: respetar `safe-area-inset` en el HUD.
- [x] Evitar zoom por doble toque, selección de texto y scroll accidental.
- [x] Limitar resolución interna (pixel ratio máx. 2) y bajar calidad si los fps caen.
- [ ] Pausar al cambiar de app y reconectar al volver.
- [ ] Cargar solo el circuito que se juega y los karts presentes; la primera carga, por debajo de 10 s con 4G.

## 6. Fases

Cada fase termina con algo jugable, tests en verde y un commit. Prompts en `docs/PROMPTS.md`.

- [x] **Fase 0 — Esqueleto.** Monorepo, Vite + Three.js, servidor Colyseus vacío, scripts, Vitest, GitHub.
  *Hecho cuando:* `npm run dev` muestra un cubo girando y el servidor responde.
- [x] **Fase 1 — Conducir.** Kart arcade con teclado en un óvalo de prueba, cámara de persecución, derrape con turbo.
  *Hecho cuando:* conducir y derrapar en PC es divertido.
- [x] **Fase 2 — Móvil.** Controles táctiles en vertical, PWA, HUD básico, medidor de fps. Probar en iPhone y Android.
  *Hecho cuando:* se juega cómodo y a ~60 fps en los móviles de tus amigos.
- [ ] **Fase 3 — Carrera y sistema de circuitos.** Formato de circuito como datos + kit de tema; circuito 1
  (Paseo del Puerto); checkpoints, vueltas, cuenta atrás, tiempos, pantalla final.
  *Hecho cuando:* puedes completar una carrera de 3 vueltas tú solo.
- [ ] **Fase 4 — Multijugador.** (Hecho y probado en local; falta la prueba con móviles en redes distintas, tras la Fase 6.) Salas con código, lobby, sincronización e interpolación, posiciones, resultados.
  *Hecho cuando:* 2+ móviles en redes distintas corren juntos sin tirones.
- [ ] **Fase 5 — Objetos.** (Hecho: en solitario y online, decididos por el servidor. Probado en local con jugadores falsos; falta probarlo en móviles de verdad.) Cajas, 4 objetos, reparto por posición, todo validado por el servidor.
  *Hecho cuando:* los objetos funcionan igual en todos los móviles.
- [ ] **Fase 6 — Despliegue.** (Preparado para Render; faltan los pasos en su web: ver docs/DESPLIEGUE.md.) Cliente y servidor publicados, HTTPS, enlace de invitación.
  *Hecho cuando:* abres el enlace desde el móvil fuera de casa y funciona (aún no se invita a nadie).
- [ ] **Fase 7 — Personajes y coches.** 5 personajes, 10 coches, estadísticas, pantalla de selección, modelos.
  *Hecho cuando:* se nota la diferencia entre un coche ligero y uno pesado y todo va fluido con 8 karts.
- [ ] **Fase 8 — Circuitos 2 a 10.** Un circuito por sesión, en orden; luego Copas y elección de circuito en el lobby.
  *Hecho cuando:* los 10 circuitos se pueden jugar, cada uno con su mecánica, a ~60 fps en móvil.
- [ ] **Fase 9 — Versión 1.0.** Sonido y música (CC0), partículas, minimapa, pantalla de podio, prueba con amigos.
  *Hecho cuando:* jugáis una copa entera entre iPhone y Android sin problemas → **lanzamiento**.
- [ ] **Después de la 1.0:** bots, contrarreloj con fantasma, circuitos espejo, más objetos.

Consejo: aunque la 1.0 sea con todo el contenido, no esperes a tenerlo todo para probar: la sensación
de conducción (Fase 1–2) es lo que decide si el juego engancha.

## 7. Cómo probar en móviles durante el desarrollo
- Misma Wi-Fi: `npm run dev:host` y abrir `http://IP-del-PC:5173` en el móvil (sin giroscopio ni PWA).
- Con HTTPS: un túnel (p. ej. Cloudflare Tunnel) o el despliegue de la Fase 6.
- Pide a tus amigos el modelo de su iPhone para saber el mínimo que hay que aguantar.

## 8. Lo que necesitas antes de empezar
- PC con **Node.js LTS**, **Git** y **Claude Code** instalados (guía oficial: https://docs.claude.com)
- Cuenta de **GitHub** (repositorio privado)
- Cuentas en un hosting de cliente y otro de servidor (ver Fase 6; todas tienen opción gratuita o muy barata)
- Un iPhone a mano para probar (el de un amigo vale)

## 9. Riesgos
| Riesgo | Cómo se mitiga |
|---|---|
| Va lento en iPhones viejos | Low-poly, límite de pixel ratio, medir fps desde la Fase 2 |
| Lag entre jugadores | Simulación local + interpolación; servidor en Europa |
| Rarezas de Safari | Probar en iPhone en cada fase |
| 10 circuitos es mucho trabajo | Circuitos como datos + kits de tema + mecánicas reutilizables; uno por sesión |
| 10 coches desequilibrados | Estadísticas que suman lo mismo; ajustar todo en `tuning.ts` tras jugar |
| La descarga pesa demasiado | Cargar bajo demanda; modelos low-poly comprimidos |
| Problemas de propiedad intelectual | Todo original y assets CC0 anotados |

## 10. Decisiones abiertas (no bloquean empezar)
- Nombre definitivo del juego
- ¿Cuántos jugadores máximos? (4 es lo seguro; 8 si va bien)
- Nombres definitivos de personajes, coches y circuitos
