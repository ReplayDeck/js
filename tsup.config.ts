import { defineConfig } from "tsup"

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    treeshake: true,
    target: "es2018",
  },
  {
    entry: { replaydeck: "src/global.ts" },
    format: ["iife"],
    globalName: "replaydeck",
    minify: true,
    treeshake: true,
    target: "es2018",
    outExtension: () => ({ js: ".global.js" }),
  },
])
