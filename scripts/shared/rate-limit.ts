/**
 * Pauses execution for the given duration.
 *
 * @param ms - Delay in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Options for {@link withRetry}.
 */
export interface RetryOptions {
  /** Number of retries after the initial attempt. */
  readonly retries?: number;
  /** Initial backoff delay in milliseconds. */
  readonly baseDelayMs?: number;
  /** Upper bound on any single backoff delay. */
  readonly maxDelayMs?: number;
  /** Invoked before each retry sleep, for logging/telemetry. */
  readonly onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Runs an async operation with exponential backoff and jitter. Retries on any
 * thrown error up to {@link RetryOptions.retries} times, then rethrows. Intended
 * to absorb transient rate-limit (429) and network errors during paid embedding
 * and Qdrant upsert calls so a whole batch is not lost to a momentary blip.
 *
 * @param operation - The async operation to attempt
 * @param options - Retry configuration
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;

  let attempt = 0;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delayMs = Math.round(backoff + Math.random() * backoff * 0.25);

      options.onRetry?.(error, attempt + 1, delayMs);
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

/**
 * Options for {@link createRateLimiter}.
 */
export interface RateLimiterOptions {
  /** Minimum delay between consecutive operations. */
  readonly minIntervalMs: number;
}

/**
 * Serializes async operations with a minimum interval between them.
 */
export interface RateLimiter {
  /** Schedules an operation after respecting the rate limit. */
  schedule<T>(operation: () => Promise<T>): Promise<T>;
}

/**
 * Creates a simple in-process rate limiter for API requests.
 *
 * @param options - Rate limiter configuration
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  let lastRunAt = 0;
  let chain: Promise<unknown> = Promise.resolve();

  return {
    schedule<T>(operation: () => Promise<T>): Promise<T> {
      const run = async (): Promise<T> => {
        const now = Date.now();
        const elapsed = now - lastRunAt;
        const waitMs = Math.max(0, options.minIntervalMs - elapsed);

        if (waitMs > 0) {
          await sleep(waitMs);
        }

        lastRunAt = Date.now();
        return operation();
      };

      const result = chain.then(run, run);
      chain = result.then(
        () => undefined,
        () => undefined,
      );

      return result;
    },
  };
}
