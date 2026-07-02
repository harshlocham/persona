/** Maximum words allowed in a single chunk before recursive splitting. */
export const MAX_CHUNK_WORDS = 700;

/** Number of overlapping words shared between adjacent sub-chunks. */
export const CHUNK_OVERLAP_WORDS = 100;

/** Placeholder emitted by the knowledge stage for empty sections. */
const EMPTY_SECTION_PLACEHOLDER = "_No content extracted._";

/**
 * A markdown section keyed by its heading.
 */
export interface MarkdownSection {
  /** Heading text without leading '#' markers. */
  readonly section: string;
  /** Heading depth (1 for '#', 2 for '##', etc.). */
  readonly depth: number;
  /** Section body with the heading line removed. */
  readonly text: string;
}

/**
 * Strips YAML frontmatter delimited by leading '---' fences.
 *
 * @param markdown - Raw markdown document
 */
export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) {
    return markdown;
  }

  const closingIndex = markdown.indexOf("\n---", 3);

  if (closingIndex === -1) {
    return markdown;
  }

  const afterClosing = markdown.indexOf("\n", closingIndex + 1);

  return afterClosing === -1 ? "" : markdown.slice(afterClosing + 1);
}

/**
 * Counts whitespace-delimited words in a text block.
 *
 * @param text - Text to measure
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Removes blockquote source lines and empty-section placeholders.
 *
 * @param body - Raw section body
 */
function cleanSectionBody(body: string): string {
  return body
    .split("\n")
    .filter((line) => line.trim() !== EMPTY_SECTION_PLACEHOLDER)
    .join("\n")
    .trim();
}

/**
 * Splits a markdown document into sections keyed by heading.
 *
 * Content preceding the first heading is discarded. Sections whose body is
 * empty (or only the empty-section placeholder) are omitted.
 *
 * @param markdown - Markdown document, optionally with frontmatter
 */
export function splitByHeadings(markdown: string): readonly MarkdownSection[] {
  const body = stripFrontmatter(markdown);
  const lines = body.split("\n");

  const sections: MarkdownSection[] = [];
  let currentHeading: string | null = null;
  let currentDepth = 0;
  let buffer: string[] = [];

  const flush = (): void => {
    if (currentHeading === null) {
      buffer = [];
      return;
    }

    const cleaned = cleanSectionBody(buffer.join("\n"));

    if (cleaned.length > 0) {
      sections.push({
        section: currentHeading,
        depth: currentDepth,
        text: cleaned,
      });
    }

    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);

    if (headingMatch) {
      flush();
      currentDepth = headingMatch[1].length;
      currentHeading = headingMatch[2].trim();
      continue;
    }

    buffer.push(line);
  }

  flush();

  return sections;
}

/**
 * Splits text into overlapping word windows when it exceeds the word limit.
 *
 * Windows contain at most {@link MAX_CHUNK_WORDS} words and share
 * {@link CHUNK_OVERLAP_WORDS} words with the previous window. Text within the
 * limit is returned unchanged as a single-element array.
 *
 * @param text - Section text to split
 * @param maxWords - Maximum words per window
 * @param overlapWords - Overlapping words between windows
 */
export function splitWithOverlap(
  text: string,
  maxWords: number = MAX_CHUNK_WORDS,
  overlapWords: number = CHUNK_OVERLAP_WORDS,
): readonly string[] {
  const words = text.trim().split(/\s+/).filter((word) => word.length > 0);

  if (words.length <= maxWords) {
    return [text.trim()];
  }

  const step = Math.max(1, maxWords - overlapWords);
  const windows: string[] = [];

  for (let start = 0; start < words.length; start += step) {
    const window = words.slice(start, start + maxWords);
    windows.push(window.join(" "));

    if (start + maxWords >= words.length) {
      break;
    }
  }

  return windows;
}
