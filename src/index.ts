import { resolveConfig, type ReplayDeckConfig } from "./config"
import { Recorder } from "./recorder"
import { Session } from "./session"
import { Transport } from "./transport"
import { ReplayDeckError } from "./types"

export { ReplayDeckError }
export type { ReplayDeckConfig }

export interface ReplayDeck {
  start(): void
  stop(): void
  flush(): Promise<void>
  getSessionId(): string
  isRecording(): boolean
}

let current: ReplayDeck | null = null

export function init(config: ReplayDeckConfig): ReplayDeck {
  if (current) return current

  const cfg = resolveConfig(config)
  const session = new Session()

  if (!shouldRecord(cfg.sampleRate, session.id)) {
    current = inert(session.id)
    return current
  }

  let recorder: Recorder
  const transport = new Transport(cfg, session, () => recorder.rotate())
  recorder = new Recorder(cfg, session, transport)
  recorder.start()

  current = {
    start: () => recorder.start(),
    stop: () => recorder.stop(),
    flush: () => recorder.flush(),
    getSessionId: () => session.id,
    isRecording: () => recorder.isRecording(),
  }
  return current
}

function shouldRecord(rate: number, id: string): boolean {
  if (rate >= 1) return true
  if (rate <= 0) return false
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 0xffffffff < rate
}

function inert(id: string): ReplayDeck {
  return {
    start() {},
    stop() {},
    flush: () => Promise.resolve(),
    getSessionId: () => id,
    isRecording: () => false,
  }
}
