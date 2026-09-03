import { ReplayDeckError, type SamplingStrategy } from "./types"

export interface ReplayDeckConfig {
  key: string
  host?: string
  maskAllInputs?: boolean
  maskTextClass?: string
  blockClass?: string
  sampleRate?: number
  flushIntervalMs?: number
  maxChunkBytes?: number
  recordCanvas?: boolean
  sampling?: SamplingStrategy
  onError?: (error: ReplayDeckError) => void
}

export interface ResolvedConfig {
  key: string
  host: string
  maskAllInputs: boolean
  maskTextClass: string
  blockClass: string
  sampleRate: number
  flushIntervalMs: number
  maxChunkBytes: number
  recordCanvas: boolean
  sampling: SamplingStrategy
  onError: (error: ReplayDeckError) => void
}

const SCROLL_SAMPLE_MS = 50

export function resolveConfig(input: ReplayDeckConfig): ResolvedConfig {
  if (!input || !input.key) {
    throw new ReplayDeckError("config", "replaydeck: `key` is required")
  }
  if (!input.host) {
    throw new ReplayDeckError("config", "replaydeck: `host` is required")
  }
  return {
    key: input.key,
    host: input.host.replace(/\/+$/, ""),
    maskAllInputs: input.maskAllInputs ?? true,
    maskTextClass: input.maskTextClass ?? "rd-mask",
    blockClass: input.blockClass ?? "rd-block",
    sampleRate: clamp01(input.sampleRate ?? 1),
    flushIntervalMs: Math.max(1000, input.flushIntervalMs ?? 5000),
    maxChunkBytes: Math.min(1_500_000, Math.max(50_000, input.maxChunkBytes ?? 900_000)),
    recordCanvas: input.recordCanvas ?? false,
    sampling: { scroll: SCROLL_SAMPLE_MS, ...input.sampling },
    onError: input.onError ?? (() => {}),
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 1
  return Math.max(0, Math.min(1, n))
}
