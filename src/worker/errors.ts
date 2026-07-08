/**
 * Retry discipline (R2): a job that fails *validation* is FINISHED (REJECTED) —
 * re-running it would fail the same way. Only *infrastructure* faults (network,
 * 429, timeout, malformed upstream) are worth retrying.
 */

/** A terminal, non-retryable failure: the output was judged/validated as unfit. */
export class ValidationRejected extends Error {
  readonly reasons: string[];
  constructor(message: string, reasons: string[] = []) {
    super(message);
    this.name = "ValidationRejected";
    this.reasons = reasons;
  }
}

/** A transient failure worth retrying (network, rate-limit, upstream 5xx, malformed response). */
export class InfraFault extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "InfraFault";
    this.cause = cause;
  }
}

export type JobOutcome = "reject" | "retry";

/**
 * Decide whether a thrown error ends the job (reject) or should be retried.
 * ValidationRejected → reject (done). Everything else (InfraFault or unknown
 * transient error) → retry, bounded by pg-boss's retryLimit.
 */
export function classifyOutcome(err: unknown): JobOutcome {
  return err instanceof ValidationRejected ? "reject" : "retry";
}
