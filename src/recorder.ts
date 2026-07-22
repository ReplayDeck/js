import { record } from "rrweb"

import type { ResolvedConfig } from "./config"
import type { Session } from "./session"
import type { Transport } from "./transport"
import type { eventWithTime } from "./types"

const CHECKOUT_MS = 5 * 60 * 1000
const MAX_EVENTS = 4000

export class Recorder {
  private stopFn: (() => void) | undefined
  private buffer: eventWithTime[] = []
  private bytes = 0
  private timer: ReturnType<typeof setInterval> | undefined
  private bound = false

  constructor(
    private cfg: ResolvedConfig,
    private session: Session,
    private transport: Transport
  ) {}

  start(): void {
    if (this.stopFn) return
    this.stopFn = record({
      emit: (event: eventWithTime) => this.onEvent(event),
      maskAllInputs: this.cfg.maskAllInputs,
      maskTextClass: this.cfg.maskTextClass,
      blockClass: this.cfg.blockClass,
      recordCanvas: this.cfg.recordCanvas,
      sampling: this.cfg.sampling,
      checkoutEveryNms: CHECKOUT_MS,
    })
    this.timer = setInterval(() => this.flush(), this.cfg.flushIntervalMs)
    this.bindUnload()
  }

  flush(): Promise<void> {
    this.cut()
    return this.transport.flush()
  }

  rotate(): void {
    this.session.rotate()
    this.buffer = []
    this.bytes = 0
    record.takeFullSnapshot()
  }

  stop(): void {
    this.stopFn?.()
    this.stopFn = undefined
    if (this.timer) clearInterval(this.timer)
    this.cut()
    this.transport.flushBeacon()
  }

  isRecording(): boolean {
    return Boolean(this.stopFn)
  }

  private onEvent(event: eventWithTime): void {
    const size = roughBytes(event)
    if (this.buffer.length > 0 && (this.bytes + size > this.cfg.maxChunkBytes || this.buffer.length >= MAX_EVENTS)) {
      this.cut()
    }
    this.buffer.push(event)
    this.bytes += size
  }

  private cut(): void {
    if (this.buffer.length === 0) return
    this.transport.enqueue(this.buffer)
    this.buffer = []
    this.bytes = 0
  }

  private bindUnload(): void {
    if (this.bound || typeof document === "undefined") return
    this.bound = true
    const onHide = () => {
      this.cut()
      this.transport.flushBeacon()
    }
    addEventListener("pagehide", onHide)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide()
    })
  }
}

function roughBytes(event: unknown): number {
  try {
    return JSON.stringify(event).length
  } catch {
    return 0
  }
}
