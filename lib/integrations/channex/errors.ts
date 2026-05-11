/**
 * Typed errors raised by the Channex API client.
 * Callers (orchestrator / worker) branch on these to decide retry policy.
 */

export type ChannexErrorCode =
  | "auth"
  | "rate_limited"
  | "validation"
  | "not_found"
  | "server"
  | "network"
  | "timeout"
  | "unknown"

export class ChannexError extends Error {
  readonly code: ChannexErrorCode
  readonly httpStatus: number | null
  readonly response: unknown
  readonly retryAfterSeconds: number | null

  constructor(opts: {
    code: ChannexErrorCode
    message: string
    httpStatus?: number | null
    response?: unknown
    retryAfterSeconds?: number | null
  }) {
    super(opts.message)
    this.name = "ChannexError"
    this.code = opts.code
    this.httpStatus = opts.httpStatus ?? null
    this.response = opts.response ?? null
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null
  }

  /** Fatal errors never auto-retry; they move straight to delivery_errors. */
  isFatal(): boolean {
    return this.code === "auth" || this.code === "not_found"
  }
}

export class ChannexAuthError extends ChannexError {
  constructor(message = "Channex authentication failed", response?: unknown) {
    super({ code: "auth", message, httpStatus: 401, response })
    this.name = "ChannexAuthError"
  }
}

export class ChannexRateLimitError extends ChannexError {
  constructor(retryAfterSeconds = 60, response?: unknown) {
    super({
      code: "rate_limited",
      message: `Channex rate limit hit, retry in ${retryAfterSeconds}s`,
      httpStatus: 429,
      response,
      retryAfterSeconds,
    })
    this.name = "ChannexRateLimitError"
  }
}

export class ChannexValidationError extends ChannexError {
  readonly warnings: unknown[]
  constructor(warnings: unknown[], response?: unknown) {
    super({
      code: "validation",
      message: `Channex returned ${warnings.length} validation warnings`,
      httpStatus: 200,
      response,
    })
    this.name = "ChannexValidationError"
    this.warnings = warnings
  }
}

export class ChannexNetworkError extends ChannexError {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error ? cause.message : "network error calling Channex"
    super({ code: "network", message })
    this.name = "ChannexNetworkError"
  }
}

export class ChannexTimeoutError extends ChannexError {
  constructor() {
    super({ code: "timeout", message: "Channex request timed out" })
    this.name = "ChannexTimeoutError"
  }
}
