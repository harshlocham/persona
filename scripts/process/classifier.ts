import type { Topic } from "../shared/types.js";

/**
 * Classification output for a processed document.
 */
export interface ClassificationResult {
  readonly topics: readonly Topic[];
  readonly summary: string;
  readonly keywords: readonly string[];
  readonly language: string;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "because",
  "before",
  "being",
  "between",
  "could",
  "first",
  "from",
  "have",
  "here",
  "into",
  "just",
  "like",
  "more",
  "only",
  "other",
  "over",
  "some",
  "than",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "with",
  "would",
  "your",
]);

const TOPIC_KEYWORDS: Record<Exclude<Topic, "general">, readonly string[]> = {
  bio: [
    "founder",
    "journey",
    "background",
    "experience",
    "career",
    "story",
    "about me",
  ],
  "teaching-style": [
    "explain",
    "example",
    "step by step",
    "tutorial",
    "walkthrough",
    "demo",
    "let's build",
    "understand",
  ],
  vocabulary: [
    "basically",
    "right",
    "okay",
    "trade-off",
    "first principles",
    "simple",
    "chai",
  ],
  philosophy: [
    "fundamental",
    "consistency",
    "practice",
    "mindset",
    "learning",
    "growth",
    "believe",
    "approach",
  ],
};

const SUMMARY_MAX_LENGTH = 240;

/**
 * Detects the dominant language of the content.
 *
 * @param content - Normalized text content
 */
export function detectLanguage(content: string): string {
  const devanagariMatches = content.match(/[\u0900-\u097F]/g)?.length ?? 0;
  const latinMatches = content.match(/[A-Za-z]/g)?.length ?? 0;
  const total = devanagariMatches + latinMatches;

  if (total === 0) {
    return "unknown";
  }

  const devanagariRatio = devanagariMatches / total;

  if (devanagariRatio > 0.6) {
    return "hi";
  }

  if (devanagariRatio > 0.15) {
    return "hi-en";
  }

  return "en";
}

/**
 * Extracts top keywords using simple token frequency analysis.
 *
 * @param content - Normalized text content
 * @param limit - Maximum number of keywords
 */
export function extractKeywords(
  content: string,
  limit = 12,
): readonly string[] {
  const tokens = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 4 &&
        !STOP_WORDS.has(token) &&
        // Require an alphabetic character: drops bare numbers and numeric
        // fragments (port numbers, prices) that dominated ASR-heavy content.
        /[a-z]/.test(token) &&
        // Drop tokens that are mostly digits (e.g. "anaconda2" stays, "12abc" goes).
        (token.match(/\d/g)?.length ?? 0) <= token.length / 2,
    );

  const frequency = new Map<string, number>();

  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

/**
 * Assigns knowledge topics using keyword heuristics.
 *
 * @param content - Normalized text content
 * @param title - Document title
 */
export function classifyTopics(
  content: string,
  title: string,
): readonly Topic[] {
  const haystack = `${title}\n${content}`.toLowerCase();
  const scored = (
    Object.entries(TOPIC_KEYWORDS) as Array<
      [Exclude<Topic, "general">, readonly string[]]
    >
  )
    .map(([topic, keywords]) => ({
      topic,
      score: keywords.reduce(
        (total, keyword) => total + (haystack.includes(keyword) ? 1 : 0),
        0,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return ["general"];
  }

  return scored.map((entry) => entry.topic);
}

/**
 * Builds a short lead summary without summarizing the full document.
 *
 * @param content - Normalized text content
 * @param title - Document title
 */
export function buildLeadSummary(content: string, title: string): string {
  const firstParagraph =
    content
      .split(/\n{2,}/)
      .map((block) => block.replace(/\s+/g, " ").trim())
      .find((block) => block.length > 0) ?? content.replace(/\s+/g, " ").trim();

  const firstSentenceMatch = firstParagraph.match(/^(.+?[.!?])(?:\s|$)/);
  const candidate = (firstSentenceMatch?.[1] ?? firstParagraph).trim();
  const prefixed = candidate.length > 0 ? candidate : title.trim();

  if (prefixed.length <= SUMMARY_MAX_LENGTH) {
    return prefixed;
  }

  return `${prefixed.slice(0, SUMMARY_MAX_LENGTH - 3).trimEnd()}...`;
}

/**
 * Classifies processed content into topics, keywords, language, and a brief lead summary.
 *
 * @param content - Normalized text content
 * @param title - Document title
 */
export function classifyContent(
  content: string,
  title: string,
): ClassificationResult {
  const topics = classifyTopics(content, title);

  return {
    topics,
    summary: buildLeadSummary(content, title),
    keywords: extractKeywords(content),
    language: detectLanguage(content),
  };
}

/**
 * Returns the primary topic for {@link ProcessedDocument.topic}.
 *
 * @param topics - Classified topics
 */
export function getPrimaryTopic(topics: readonly Topic[]): Topic {
  return topics[0] ?? "general";
}
