import type { ResolvedConfig } from "./config"
import type { Session } from "./session"
import { ReplayDeckError, type eventWithTime } from "./types"

type Batch = eventWithTime[]
type Action = "ok" | "retry" | "rotate" | "drop" | "fatal"

const MAX_BACKOFF_MS = 30_000
const KEEPALIVE_LIMIT = 60_000

function classify(status: number): Action {
  switch (status) {
    case 204:
      return "ok"
    case 409:
    case 410:
      return "rotate"
    case 400:
    case 413:
      return "drop"
    case 401:
    case 403:
      return "fatal"
    default:
      return "retry"
  }
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class Transport {
  private queue: Batch[] = []
  private sending = false
  private stopped = false
  private attempt = 0
  private waiters: Array<() => void> = []

  constructor(
    private cfg: ResolvedConfig,
    private session: Session,
    private onRotate: () => void,
    private sleep: (ms: number) => Promise<void> = realSleep
  ) {}

  enqueue(batch: Batch): void {
    if (this.stopped || batch.length === 0) return
    this.queue.push(batch)
    void this.pump()
  }

  flush(): Promise<void> {
    if (this.queue.length === 0 && !this.sending) return Promise.resolve()
    return new Promise((resolve) => {
      this.waiters.push(resolve)
      void this.pump()
    })
  }

  flushBeacon(): void {
    if (this.stopped || typeof navigator === "undefined" || !navigator.sendBeacon) return
    let seq = this.session.seq
    for (const batch of this.queue) {
      navigator.sendBeacon(this.endpoint(), this.body(batch, seq))
      seq += 1
    }
    this.queue = []
  }

  stop(): void {
    this.stopped = true
    this.queue = []
    this.settle()
  }

  private endpoint(): string {
    return `${this.cfg.host}/ingest?k=${encodeURIComponent(this.cfg.key)}`
  }

  private body(batch: Batch, seq: number): string {
    return JSON.stringify({
      sessionId: this.session.id,
      seq,
      events: batch,
      url: location.href,
      ua: navigator.userAgent,
    })
  }

  private async pump(): Promise<void> {
    if (this.sending || this.stopped) return
    this.sending = true
    try {
      while (this.queue.length > 0 && !this.stopped) {
        const batch = this.queue[0]!
        const status = await this.post(this.body(batch, this.session.seq))
        const action = classify(status)

        if (action === "ok") {
          this.queue.shift()
          this.session.advance()
          this.attempt = 0
        } else if (action === "retry") {
          await this.sleep(this.backoff())
        } else if (action === "drop") {
          this.queue.shift()
          this.cfg.onError(new ReplayDeckError("too_large", `replaydeck: chunk dropped (status ${status})`))
        } else if (action === "rotate") {
          this.queue = []
          this.onRotate()
          break
        } else {
          this.stopped = true
          this.queue = []
          this.cfg.onError(
            new ReplayDeckError(status === 401 ? "bad_key" : "bad_origin", `replaydeck: ingest rejected (status ${status})`)
          )
          break
        }
      }
    } finally {
      this.sending = false
      if (this.queue.length === 0) this.settle()
    }
  }

  private async post(body: string): Promise<number> {
    try {
      const res = await fetch(this.endpoint(), {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body,
        keepalive: body.length < KEEPALIVE_LIMIT,
      })
      return res.status
    } catch {
      return 0
    }
  }

  private backoff(): number {
    const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.attempt)
    this.attempt += 1
    return base / 2 + Math.random() * (base / 2)
  }

  private settle(): void {
    const waiters = this.waiters
    this.waiters = []
    for (const resolve of waiters) resolve()
  }
}
