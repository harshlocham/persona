import type { BuiltKnowledgeDocument, KnowledgeSections } from "./types.js";

const SECTION_HEADINGS = {
  mainConcepts: "Main Concepts",
  practicalAdvice: "Practical Advice",
  teachingPattern: "Teaching Pattern",
  importantVocabulary: "Important Vocabulary",
  examples: "Examples",
  commonMistakes: "Common Mistakes",
  keyTakeaways: "Key Takeaways",
} as const satisfies Record<keyof KnowledgeSections, string>;

/**
 * Escapes characters that would break YAML frontmatter strings.
 *
 * @param value - Raw metadata value
 */
function escapeYamlValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Renders a markdown bullet list section.
 *
 * @param heading - Section heading
 * @param items - Section items
 */
function renderBulletSection(heading: string, items: readonly string[]): string {
  if (items.length === 0) {
    return `## ${heading}\n\n_No content extracted._\n`;
  }

  const bullets = items.map((item) => `- ${item.trim()}`).join("\n");
  return `## ${heading}\n\n${bullets}\n`;
}

/**
 * Renders YAML frontmatter for a knowledge document.
 *
 * @param document - Built knowledge document
 */
export function renderKnowledgeFrontmatter(
  document: BuiltKnowledgeDocument,
): string {
  const { metadata } = document;

  return [
    "---",
    `id: "${escapeYamlValue(document.id)}"`,
    `personaId: "${escapeYamlValue(document.personaId)}"`,
    `processedDocumentId: "${escapeYamlValue(document.processedDocumentId)}"`,
    `topic: "${escapeYamlValue(metadata.topic)}"`,
    `language: "${escapeYamlValue(metadata.language)}"`,
    `createdAt: "${escapeYamlValue(metadata.createdAt)}"`,
    `sourceType: "${escapeYamlValue(metadata.source.sourceType)}"`,
    `sourceUrl: "${escapeYamlValue(metadata.source.sourceUrl)}"`,
    `rawDocumentId: "${escapeYamlValue(metadata.source.rawDocumentId)}"`,
    `keywords: [${metadata.keywords.map((keyword) => `"${escapeYamlValue(keyword)}"`).join(", ")}]`,
    `topics: [${metadata.topics.map((topic) => `"${escapeYamlValue(topic)}"`).join(", ")}]`,
    "---",
  ].join("\n");
}

/**
 * Renders the full markdown knowledge document.
 *
 * @param document - Built knowledge document
 */
export function renderKnowledgeMarkdown(
  document: BuiltKnowledgeDocument,
): string {
  const { metadata, title, summary } = document;
  const sections = metadata.sections;

  return [
    renderKnowledgeFrontmatter(document),
    "",
    `# ${title}`,
    "",
    "> Source: [" + metadata.source.title + "](" + metadata.source.sourceUrl + ")",
    "",
    `**Summary:** ${summary}`,
    "",
    renderBulletSection(SECTION_HEADINGS.mainConcepts, sections.mainConcepts),
    renderBulletSection(SECTION_HEADINGS.practicalAdvice, sections.practicalAdvice),
    renderBulletSection(SECTION_HEADINGS.teachingPattern, sections.teachingPattern),
    renderBulletSection(
      SECTION_HEADINGS.importantVocabulary,
      sections.importantVocabulary,
    ),
    renderBulletSection(SECTION_HEADINGS.examples, sections.examples),
    renderBulletSection(SECTION_HEADINGS.commonMistakes, sections.commonMistakes),
    renderBulletSection(SECTION_HEADINGS.keyTakeaways, sections.keyTakeaways),
  ].join("\n");
}
