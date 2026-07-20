import type { eventWithTime } from "rrweb"

export type { eventWithTime }

export type ErrorCode = "config" | "bad_key" | "bad_origin" | "too_large" | "network"

export class ReplayDeckError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = "ReplayDeckError"
  }
}
