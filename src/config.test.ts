import { describe, expect, it } from "vitest"

import { resolveConfig } from "./config"

const required = { key: "site-key", host: "https://collector.test" }

describe("resolveConfig", () => {
  it("leaves sampling empty so rrweb keeps its own defaults", () => {
    expect(resolveConfig(required).sampling).toEqual({})
  })

  it("hands sampling through untouched", () => {
    const sampling = { mousemove: 30, scroll: 100 }
    expect(resolveConfig({ ...required, sampling }).sampling).toEqual(sampling)
  })
})
