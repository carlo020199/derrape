# Publicar Derrape (Fase 6)

Objetivo: abrir el juego desde el móvil **fuera de casa** (4G o la Wi-Fi de otro) y jugar con amigos.
Hacen falta dos cosas en internet:
- **La web** (lo que se abre en el móvil): archivos estáticos.
- **El servidor de juego** (salas y carreras): un programa Node.js siempre accesible, con WebSockets.

## Comparativa para nuestro caso (pocos amigos, coste mínimo, Europa)

Precios consultados en octubre de 2026 (cambian a menudo; ver fuentes al final).

| Opción | Para | Coste | En Europa | Pega |
|---|---|---|---|---|
| **Render (gratis)** | servidor + web | **0 €** | Frankfurt | El servidor se duerme tras 15 min sin jugar y tarda ~1 min en despertar |
| Fly.io | servidor | ~2 $/mes encendido siempre (menos si se apaga solo) | Madrid | Pide tarjeta; sin plan gratis para cuentas nuevas |
| Railway | servidor | 5 $/mes | Sí | De pago desde el principio (tras una prueba de 5 $) |
| Cloudflare Pages | web | 0 € | CDN mundial | Otra cuenta más; Cloudflare empuja ahora "Workers" para proyectos nuevos |

### Recomendación: Render para todo
- **0 €**, una sola cuenta, y el archivo `render.yaml` del repositorio lo configura todo:
  crea los dos servicios y le pasa a la web la dirección del servidor automáticamente.
- El servidor está en **Frankfurt** (buena latencia desde España).
- Los WebSockets cuentan como actividad: mientras jugáis, el servidor no se duerme.
- **Lo del minuto de espera**: la web despierta al servidor nada más abrirse, mientras escribís el
  nombre, y avisa con "Despertando el servidor…". Solo pasa la primera vez tras un rato sin jugar.
- El plan gratis da 750 horas al mes: de sobra para un servidor (un mes tiene 744).

Si un día el minuto de espera os molesta: **Fly.io en Madrid** (~2 $/mes) despierta en segundos.
Dímelo y lo preparo (necesita un Dockerfile, que probaría antes).

## Lo que ya está preparado
- `render.yaml`: servidor (`derrape-servidor`, gratis, Frankfurt, comprobación de salud en `/health`)
  y web (`derrape`, estática). Se vuelven a publicar solos con cada cambio que se sube a GitHub.
- `.node-version`: Node 22.
- La web lee la dirección del servidor de `VITE_SERVER_HOST` (o `VITE_SERVER_URL`).
- **No hace falta ninguna contraseña ni clave secreta** en la configuración.

Probado en local imitando la publicación: instalación limpia con los mismos comandos que usará Render,
servidor de producción en un puerto y web de producción en otro (dominios distintos, como en Render),
crear sala, unirse un jugador y empezar la carrera.

## Pasos que tienes que hacer tú (una sola vez)

1. **Crear la cuenta.** Entra en <https://render.com> → **Get Started** → elige **GitHub** para
   registrarte y autoriza a Render. (Para los servicios gratuitos no debería pedirte tarjeta; si te la
   pide, para y dímelo antes de ponerla.)
2. **Nuevo Blueprint.** En el panel de Render: botón **New** (arriba) → **Blueprint**.
3. **Dar acceso al repositorio.** Si `derrape` no sale en la lista: **Configure GitHub** (o "Connect
   account") → en GitHub elige **Only select repositories** → marca `carlo020199/derrape` → **Save**.
4. **Elegir el repositorio** `derrape` → Render encuentra `render.yaml` y muestra dos servicios:
   `derrape-servidor` (Free, Frankfurt) y `derrape` (Static Site).
   Ponle un nombre al Blueprint (por ejemplo, `derrape`) y pulsa **Deploy Blueprint** (o **Apply**).
5. **Esperar** 3–6 minutos hasta que los dos salgan como **Live** (verde).
6. **Comprobar el servidor.** Abre el servicio `derrape-servidor`, copia su dirección
   (algo como `https://derrape-servidor.onrender.com`) y ábrela añadiendo `/health` al final:
   debe salir `{"ok":true,...}`.
7. **Abrir el juego.** Abre el servicio `derrape` y su dirección (algo como
   `https://derrape.onrender.com`; si el nombre está cogido, Render le añade unas letras).
   Esa es la dirección para tus amigos.
8. **Probar fuera de casa.** En un móvil con **datos (Wi-Fi apagada)**: abre la web → Crear sala →
   Invitar. En otro móvil (otra red): abre el enlace → Unirse. EMPEZAR.
9. **Añadir a la pantalla de inicio** (ahora sí, con HTTPS):
   iPhone: Safari → Compartir → "Añadir a pantalla de inicio". Android: Chrome → ⋮ → "Añadir a pantalla de inicio".
   Con HTTPS ya funciona también el giroscopio (Ajustes → "Girar inclinando el móvil").

Cuando lo tengas, pásame la dirección de la web: compruebo el servidor desde aquí y meto un jugador
falso en tu sala para que puedas probar solo.

### Si algo falla
- **La web dice "No se puede conectar con el servidor"**: puede que Render no haya pasado la dirección
  del servidor a la web. En el servicio `derrape` → **Environment** → añade la variable
  `VITE_SERVER_HOST` con el dominio del servidor **sin** `https://` (por ejemplo
  `derrape-servidor.onrender.com`) → **Manual Deploy** → **Clear build cache & deploy**.
- **Tarda mucho en crear la sala**: es el servidor despertando (hasta ~1 minuto). Luego va normal.
- **Un despliegue falla**: en el servicio → **Logs**; cópiame las últimas líneas.

## Después
- Cada vez que suba cambios a GitHub, Render vuelve a publicar solo (unos minutos).
  Si estáis jugando en ese momento, la sala se corta: mejor no subir cambios en plena partida.
- Para jugar en casa mientras desarrollamos, sigue valiendo `npm run dev:host`.

## Fuentes
- [Render — Deploy for Free](https://render.com/docs/free): se duerme tras 15 min, ~1 min en despertar, 750 h/mes.
- [Render — los WebSockets mantienen despierto el servidor gratis (feb. 2026)](https://render.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages).
- [Render — Blueprint (render.yaml)](https://render.com/docs/blueprint-spec): regiones (frankfurt), plan free, `fromService` con `host`.
- [Fly.io — precios](https://fly.io/docs/about/pricing/): shared-cpu-1x 256 MB, 1,94 $/mes; sin plan gratis para cuentas nuevas.
- [Railway — precios](https://docs.railway.com/reference/pricing): Hobby 5 $/mes; prueba con 5 $ de crédito.
- [Cloudflare Pages vs Workers (2026)](https://flaviocopes.com/cloudflare-pages-vs-workers/): Pages sigue soportado; Workers recomendado para proyectos nuevos.
