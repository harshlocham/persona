export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Minimal structured logger for pipeline scripts.
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const contextSuffix =
    context && Object.keys(context).length > 0
      ? ` ${JSON.stringify(context)}`
      : "";

  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextSuffix}`;
}

function write(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  const formatted = formatMessage(level, message, context);

  if (level === "error") {
    console.error(formatted);
    return;
  }

  if (level === "warn") {
    console.warn(formatted);
    return;
  }

  console.log(formatted);
}

/**
 * Creates the default pipeline logger writing to stdout/stderr.
 */
export function createLogger(): Logger {
  return {
    debug(message, context) {
      write("debug", message, context);
    },
    info(message, context) {
      write("info", message, context);
    },
    warn(message, context) {
      write("warn", message, context);
    },
    error(message, context) {
      write("error", message, context);
    },
  };
}

/** Shared logger instance for pipeline scripts. */
export const logger = createLogger();
