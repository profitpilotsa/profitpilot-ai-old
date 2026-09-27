import { defineConfig } from "vitest/config";

/** Avoids loading the UI Vite configuration for server-only foundation tests. */
export default defineConfig({ test: { environment: "node", include: ["tests/phase1-*.test.ts"], pool: "forks" } });
