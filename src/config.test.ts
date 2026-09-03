import { describe, expect, it } from "vitest"

import { resolveConfig } from "./config"

const required = { key: "site-key", host: "https://collector.test" }

describe("resolveConfig", () => {
  it("samples scroll at 50ms by default so replay scrolling stays continuous", () => {
    expect(resolveConfig(required).sampling).toEqual({ scroll: 50 })
  })

  it("lets the caller override any sampling key", () => {
    const sampling = { mousemove: 30, scroll: 100 }
    expect(resolveConfig({ ...required, sampling }).sampling).toEqual(sampling)
  })
})
