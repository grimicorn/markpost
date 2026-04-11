import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@libs": resolve(__dirname, "./src/libs"),
      "@t": resolve(__dirname, "./src/types"),
      "@fns": resolve(__dirname, "./src/functions"),
    },
  },
  test: {
    include: ["tests/**/*.ts"],
  },
});
