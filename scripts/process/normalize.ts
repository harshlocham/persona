const CODE_FENCE_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]+`/g;

interface PreservedSegment {
  readonly placeholder: string;
  readonly value: string;
}

/**
 * Replaces preserved segments with placeholders so normalization skips them.
 *
 * @param content - Input content
 * @param pattern - RegExp for segments to preserve
 * @param label - Placeholder label prefix
 */
function preserveSegments(
  content: string,
  pattern: RegExp,
  label: string,
): { text: string; segments: PreservedSegment[] } {
  const segments: PreservedSegment[] = [];
  let index = 0;

  const text = content.replace(pattern, (match) => {
    const placeholder = `__${label}_${index}__`;
    segments.push({ placeholder, value: match });
    index += 1;
    return placeholder;
  });

  return { text, segments };
}

/**
 * Restores preserved placeholders back to their original values.
 *
 * @param content - Text containing placeholders
 * @param segments - Preserved segment map
 */
function restoreSegments(
  content: string,
  segments: readonly PreservedSegment[],
): string {
  return segments.reduce(
    (result, segment) => result.replace(segment.placeholder, segment.value),
    content,
  );
}

/**
 * Normalizes unicode and whitespace while preserving markdown code blocks.
 *
 * @param content - Cleaned text content
 */
export function normalizeContent(content: string): string {
  const fenced = preserveSegments(content, CODE_FENCE_PATTERN, "CODE_FENCE");
  const inline = preserveSegments(
    fenced.text,
    INLINE_CODE_PATTERN,
    "INLINE_CODE",
  );

  const normalized = inline.text
    .normalize("NFKC")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return restoreSegments(
    restoreSegments(normalized, inline.segments),
    fenced.segments,
  );
}
