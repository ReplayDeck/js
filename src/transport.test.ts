import { describe, expect, it, vi } from "vitest"

import { resolveConfig } from "./config"
import { Session } from "./session"
import { Transport } from "./transport"
import type { eventWithTime } from "./types"

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

const cfg = (over = {}) => resolveConfig({ key: "site-key", host: "http://collector.test", ...over })
const evt = { type: 3, timestamp: 1, data: {} } as unknown as eventWithTime
const instant = async () => {}

function respondWith(statuses: number[]) {
  let i = 0
  const seqs: number[] = []
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    seqs.push(JSON.parse(init.body).seq)
    return { status: statuses[i++] ?? 204 } as Response
  })
  vi.stubGlobal("fetch", fetchMock)
  return { seqs, fetchMock }
}

describe("Transport", () => {
  it("keeps seq contiguous and retries the same seq on failure", async () => {
    const session = new Session(memStore())
    const { seqs } = respondWith([503, 204, 204])
    const t = new Transport(cfg(), session, () => {}, instant)
    t.enqueue([evt])
    t.enqueue([evt])
    await t.flush()
    expect(seqs).toEqual([0, 0, 1])
    expect(session.seq).toBe(2)
  })

  it("rotates the session on 410 without advancing seq", async () => {
    const session = new Session(memStore())
    const before = session.id
    respondWith([410, 204])
    let rotated = false
    const t = new Transport(
      cfg(),
      session,
      () => {
        rotated = true
        session.rotate()
      },
      instant
    )
    t.enqueue([evt])
    await t.flush()
    expect(rotated).toBe(true)
    expect(session.seq).toBe(0)
    expect(session.id).not.toBe(before)
  })

  it("stops and reports bad_key on a fatal 401", async () => {
    const session = new Session(memStore())
    const onError = vi.fn()
    respondWith([401])
    const t = new Transport(cfg({ onError }), session, () => {}, instant)
    t.enqueue([evt])
    await t.flush()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "bad_key" }))
    expect(session.seq).toBe(0)
  })

  it("posts a CORS-simple text/plain request to the ingest endpoint", async () => {
    const session = new Session(memStore())
    const { fetchMock } = respondWith([204])
    const t = new Transport(cfg(), session, () => {}, instant)
    t.enqueue([evt])
    await t.flush()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("http://collector.test/ingest?k=site-key")
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("text/plain")
  })
})
