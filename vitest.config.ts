import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // En hilos y no en procesos: Colyseus confunde process.send de los procesos de Vitest con PM2.
    pool: "threads",
  },
});
