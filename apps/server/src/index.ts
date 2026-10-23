import { SERVER_PORT } from "@derrape/shared";
import { startServer } from "./server";

const PORT = Number(process.env.PORT ?? SERVER_PORT);

// Al recargar en desarrollo (Windows), el proceso anterior puede tardar un momento en soltar el
// puerto: se reintenta unas cuantas veces antes de rendirse.
async function main() {
  for (let attempt = 1; ; attempt++) {
    try {
      await startServer(PORT);
      console.log(`Servidor Derrape en http://localhost:${PORT} (salud: /health)`);
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EADDRINUSE" || attempt >= 20) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

void main();
