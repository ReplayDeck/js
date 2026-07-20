import { describe, expect, it } from "vitest"

import { Session } from "./session"

function memStore(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => {
      m.set(k, String(v))
    },
    removeItem: (k) => {
      m.delete(k)
    },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  } as Storage
}

describe("Session", () => {
  it("persists id and seq and restores them on reload", () => {
    const store = memStore()
    const s = new Session(store)
    const id = s.id
    expect(s.seq).toBe(0)
    s.advance()
    s.advance()
    expect(s.seq).toBe(2)

    const reloaded = new Session(store)
    expect(reloaded.id).toBe(id)
    expect(reloaded.seq).toBe(2)
  })

  it("rotate mints a new id and resets seq to 0", () => {
    const store = memStore()
    const s = new Session(store)
    s.advance()
    const before = s.id
    s.rotate()
    expect(s.id).not.toBe(before)
    expect(s.seq).toBe(0)
  })
})
