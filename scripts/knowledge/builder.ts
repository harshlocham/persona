import type { ProcessedDocumentInput } from "../shared/schemas.js";
import type { Topic } from "../shared/types.js";
import { renderKnowledgeMarkdown } from "./templates.js";
import type {
  BuiltKnowledgeDocument,
  KnowledgeDocumentMetadata,
  KnowledgeSections,
  KnowledgeSourceAttribution,
} from "./types.js";

const MAX_ITEMS_PER_SECTION = 8;
const MAX_ITEM_LENGTH = 280;

/**
 * Splits processed content into sentence-like units.
 *
 * @param content - Normalized document content
 */
export function splitIntoSentences(content: string): readonly string[] {
  const units = [
    ...content.split(/\n+/),
    ...content.replace(/\n+/g, " ").split(/(?<=[.!?।])\s+/),
  ]
    .map((unit) => unit.replace(/\s+/g, " ").trim())
    .filter((unit) => unit.length >= 20);

  const seen = new Set<string>();

  return units.filter((unit) => {
    const key = unit.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Truncates a line for section inclusion.
 *
 * @param text - Candidate text
 */
function truncateItem(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_ITEM_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_ITEM_LENGTH - 3).trimEnd()}...`;
}

/**
 * Deduplicates and limits section items.
 *
 * @param items - Candidate section items
 */
function finalizeSection(items: readonly string[]): readonly string[] {
  const seen = new Set<string>();

  return items
    .map(truncateItem)
    .filter((item) => {
      const key = item.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS_PER_SECTION);
}

/**
 * Tests whether a sentence matches any pattern.
 *
 * @param sentence - Sentence to test
 * @param patterns - Case-insensitive patterns
 */
function matchesAny(sentence: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(sentence));
}

/**
 * Extracts code-like tokens and vocabulary terms.
 *
 * @param content - Document content
 * @param keywords - Classifier keywords
 */
function extractVocabulary(
  content: string,
  keywords: readonly string[],
): readonly string[] {
  const codeTokens =
    content.match(
      /\b(?:console\.log|setTimeout|setImmediate|require|process\.env|fs\.[a-zA-Z]+|crypto\.[a-zA-Z]+|[A-Za-z_$][\w$]*\(\)|`[^`\n]+`)\b/g,
    ) ?? [];

  const unique = new Set<string>([
    ...keywords,
    ...codeTokens.map((token) => token.replace(/`/g, "").trim()),
  ]);

  return [...unique].filter((token) => token.length >= 3);
}

/**
 * Builds structured knowledge sections from processed content.
 *
 * @param processed - Validated processed document
 */
export function buildKnowledgeSections(
  processed: ProcessedDocumentInput,
): KnowledgeSections {
  const sentences = splitIntoSentences(processed.content);
  const metadata = processed.metadata ?? {};
  const keywords = Array.isArray(metadata.keywords)
    ? (metadata.keywords as string[])
    : [];
  const leadSummary =
    typeof metadata.summary === "string" ? metadata.summary : processed.title;

  const conceptPatterns = [
    /\b(is|are|means|called|known as|architecture|concept|loop|thread|engine)\b/i,
    /\b(v8|libuv|event loop|thread pool|nodejs|javascript)\b/i,
  ];
  const advicePatterns = [
    /\b(you can|you should|we can|try|use|make sure|remember|avoid|prefer)\b/i,
    /(कर सकते|चाहिए|ट्राई|यूज़|याद रख|जरूर|must|should)/i,
  ];
  const teachingPatterns = [
    /\b(let's|let us|step by step|walkthrough|demo|example|see on screen|run)\b/i,
    /(देखते हैं|देखने वाले|समझते हैं|चलते हैं|ट्राई कर|रन कर|स्टेप|walkthrough)/i,
  ];
  const examplePatterns = [
    /\b(for example|e\.g\.|such as|sample|instance)\b/i,
    /\b(उदाहरण|जैसे|example)\b/i,
    /`[^`\n]+`/,
    /\bconsole\.log\b/,
  ];
  const mistakePatterns = [
    /\b(don't|do not|mistake|wrong|avoid|never|issue|problem|fail)\b/i,
    /(गलत|मत कर|नहीं कर|प्रॉब्लम|इशू|mistake|wrong)/i,
  ];

  const mainConcepts = finalizeSection(
    sentences.filter((sentence) => matchesAny(sentence, conceptPatterns)),
  );
  const practicalAdvice = finalizeSection(
    sentences.filter((sentence) => matchesAny(sentence, advicePatterns)),
  );
  const teachingPattern = finalizeSection(
    sentences.filter((sentence) => matchesAny(sentence, teachingPatterns)),
  );
  const examples = finalizeSection(
    sentences.filter((sentence) => matchesAny(sentence, examplePatterns)),
  );
  const commonMistakes = finalizeSection(
    sentences.filter((sentence) => matchesAny(sentence, mistakePatterns)),
  );

  const importantVocabulary = finalizeSection(
    extractVocabulary(processed.content, keywords),
  );

  const keyTakeaways = finalizeSection([
    truncateItem(leadSummary),
    ...sentences.slice(-3),
  ]);

  return {
    mainConcepts,
    practicalAdvice,
    teachingPattern,
    importantVocabulary,
    examples,
    commonMistakes,
    keyTakeaways,
  };
}

/**
 * Builds source attribution from a processed document.
 *
 * @param processed - Validated processed document
 */
export function buildSourceAttribution(
  processed: ProcessedDocumentInput,
): KnowledgeSourceAttribution {
  const metadata = processed.metadata ?? {};
  const sourceUrl =
    typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : "";

  return {
    sourceType: processed.sourceType,
    sourceUrl,
    rawDocumentId: processed.rawDocumentId,
    processedDocumentId: processed.id,
    title: processed.title,
  };
}

/**
 * Converts a processed document into a built knowledge artifact.
 *
 * @param processed - Validated processed document
 */
export function buildKnowledgeDocument(
  processed: ProcessedDocumentInput,
): BuiltKnowledgeDocument {
  const metadataRecord = processed.metadata ?? {};
  const topics = Array.isArray(metadataRecord.topics)
    ? (metadataRecord.topics as Topic[])
    : [processed.topic];
  const keywords = Array.isArray(metadataRecord.keywords)
    ? (metadataRecord.keywords as string[])
    : [];
  const language =
    typeof metadataRecord.language === "string"
      ? metadataRecord.language
      : "unknown";
  const summary =
    typeof metadataRecord.summary === "string"
      ? metadataRecord.summary
      : processed.title;
  const createdAt = new Date().toISOString();

  const sections = buildKnowledgeSections(processed);
  const source = buildSourceAttribution(processed);

  const metadata: KnowledgeDocumentMetadata = {
    source,
    topic: processed.topic,
    topics,
    keywords,
    language,
    createdAt,
    sections,
  };

  const built: BuiltKnowledgeDocument = {
    id: `knowledge-${processed.id}`,
    personaId: processed.personaId,
    processedDocumentId: processed.id,
    topic: processed.topic,
    title: processed.title,
    summary: truncateItem(summary),
    content: processed.content,
    markdown: "",
    metadata,
  };

  const markdown = renderKnowledgeMarkdown(built);

  return {
    ...built,
    markdown,
  };
}
