# Derrape

Juego de karts multijugador para móvil, en el navegador. Ver `CLAUDE.md` y `docs/PLAN.md`.

## Arrancar

    npm install
    npm run dev

- Juego: http://localhost:5173
- Servidor: http://localhost:2567/health

## Probar en el móvil (misma Wi-Fi)

    npm run dev:host

Abre en el móvil la dirección "Network" que muestra Vite (p. ej. `http://192.168.1.20:5173`).

## Multijugador en casa
1. `npm run dev:host` en el PC.
2. En un móvil: "Crear sala" → sale un código de 4 letras → "Invitar amigos".
3. En otro móvil (misma Wi-Fi): abrir el enlace, o escribir el código y "Unirse".
4. El anfitrión elige circuito y pulsa EMPEZAR.

¿Solo tienes un móvil? Un jugador falso se une a la sala y da vueltas solo:

    npx tsx scripts/jugador-falso.ts CODIGO [nombre]

Para simular mala conexión: F1 en el PC → sección "red" (retraso, variación y pérdida de paquetes).

## Publicado en internet
Configuración para Render (gratis) en `render.yaml`. Pasos en `docs/DESPLIEGUE.md`.

## Otros comandos
- `npm test`: tests (Vitest)
- `npm run build`: comprobación de tipos y build de cliente y servidor
