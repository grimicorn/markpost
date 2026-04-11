import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@libs": resolve(__dirname, "./src/libs"),
      "@t": resolve(__dirname, "./src/types"),
    },
  },
  test: {
    include: ["tests/**/*.ts"],
  },
});
