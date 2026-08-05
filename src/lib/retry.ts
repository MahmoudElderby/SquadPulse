export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxTotalMs?: number;
  skipStatusCodes?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxTotalMs: 60000,
  skipStatusCodes: [401, 403],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const start = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (status && opts.skipStatusCodes.includes(status)) {
        throw err;
      }
      if (attempt === opts.maxAttempts) break;
      const elapsed = Date.now() - start;
      const delay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      if (elapsed + delay > opts.maxTotalMs) break;
      await sleep(delay);
    }
  }

  throw lastError;
}
