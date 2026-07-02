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
