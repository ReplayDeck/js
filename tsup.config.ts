import { readFileSync } from "node:fs"
import { defineConfig } from "tsup"

const { version } = JSON.parse(readFileSync("./package.json", "utf8"))
const define = { __REPLAYDECK_VERSION__: JSON.stringify(version) }

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    treeshake: true,
    target: "es2018",
    define,
  },
  {
    entry: { replaydeck: "src/global.ts" },
    format: ["iife"],
    globalName: "replaydeck",
    minify: true,
    treeshake: true,
    target: "es2018",
    outExtension: () => ({ js: ".global.js" }),
    define,
  },
])
