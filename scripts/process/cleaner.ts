/**
 * Statistics about content removed during cleaning.
 */
export interface CleaningStats {
  readonly sponsorLines: number;
  readonly introOutroLines: number;
  readonly timestampLines: number;
}

/**
 * Result of the cleaning step.
 */
export interface CleaningResult {
  readonly content: string;
  readonly stats: CleaningStats;
}

const SPONSOR_PATTERNS: readonly RegExp[] = [
  /\b(sponsor(?:ed)?|affiliate|promo(?:tion)?|discount code|use code)\b/i,
  /\b(join (?:our |the |my )?(?:cohort|course|bootcamp|community|discord|telegram))\b/i,
  /\b(link in (?:the )?description|check out (?:my |the )?course|enroll (?:now|today))\b/i,
  /\b(amzn\.to|bit\.ly|piyushgarg\.|teachyst|udemy|skyping|wisprtype)\b/i,
  /\b(follow me on|subscribe(?: and)?|hit the bell|like and subscribe)\b/i,
];

const INTRO_OUTRO_PATTERNS: readonly RegExp[] = [
  /^\s*(?:hey|hi|hello|welcome back|good morning|good evening)\b/i,
  /\b(thanks for watching|see you in the next (?:video|one)|until next time)\b/i,
  /\b(that(?:'s| is) (?:it|all) for (?:this|today'?s?) video)\b/i,
  /\b(smash (?:the )?like|share (?:this )?video)\b/i,
];

const TIMESTAMP_PATTERNS: readonly RegExp[] = [
  /^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/,
  /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*/,
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
];

/**
 * Normalizes repeated punctuation without flattening markdown emphasis.
 *
 * @param text - Input text
 */
function normalizePunctuation(text: string): string {
  return text
    .replace(/([!?])\1{2,}/g, "$1")
    .replace(/\.{4,}/g, "...")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?!\s|$)/g, "$1 ");
}

/**
 * Removes sponsor-related lines from content.
 *
 * @param line - Single line of text
 */
function isSponsorLine(line: string): boolean {
  return SPONSOR_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Removes common intro/outro filler lines.
 *
 * @param line - Single line of text
 */
function isIntroOutroLine(line: string): boolean {
  return INTRO_OUTRO_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Strips timestamp tokens from a line.
 *
 * @param line - Single line of text
 */
function stripTimestamps(line: string): string {
  let result = line;

  for (const pattern of TIMESTAMP_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  return result;
}

/**
 * Cleans raw document text by removing sponsors, intros/outros, timestamps,
 * and redundant whitespace.
 *
 * @param content - Raw text content
 */
export function cleanContent(content: string): CleaningResult {
  const stats = {
    sponsorLines: 0,
    introOutroLines: 0,
    timestampLines: 0,
  } satisfies CleaningStats;

  const cleanedLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      if (isSponsorLine(line)) {
        stats.sponsorLines += 1;
        return false;
      }

      if (isIntroOutroLine(line)) {
        stats.introOutroLines += 1;
        return false;
      }

      return true;
    })
    .map((line) => {
      const withoutTimestamps = stripTimestamps(line).trim();

      if (withoutTimestamps.length === 0 && line.length > 0) {
        stats.timestampLines += 1;
      }

      return withoutTimestamps;
    })
    .filter(Boolean);

  const joined = normalizePunctuation(cleanedLines.join("\n"))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    content: joined,
    stats,
  };
}
