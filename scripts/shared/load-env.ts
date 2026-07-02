import fs from "node:fs";
import path from "node:path";

/**
 * Parses a single line from a dotenv file.
 *
 * @param line - Raw line content
 */
function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

/**
 * Loads variables from a dotenv file into `process.env`.
 *
 * @param filePath - Absolute path to the env file
 * @param override - When true, overwrites existing environment variables
 */
function loadEnvFile(filePath: string, override: boolean): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");

  for (const line of content.split("\n")) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    if (override || process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

/**
 * Loads `.env` and `.env.local` from the project root into `process.env`.
 *
 * Mirrors Next.js precedence: `.env.local` overrides `.env`.
 * Existing shell environment variables are preserved unless overridden
 * by `.env.local`.
 *
 * @param rootDir - Project root directory (defaults to `process.cwd()`)
 */
export function loadEnvFiles(rootDir: string = process.cwd()): void {
  loadEnvFile(path.join(rootDir, ".env"), false);
  loadEnvFile(path.join(rootDir, ".env.local"), true);
}
