import { createHash } from "node:crypto";

import type { ChunkDocumentInput } from "../shared/schemas.js";
import type {
  ChunkSourceAttribution,
  KnowledgeDocument,
  PipelinePersonaId,
  Topic,
} from "../shared/types.js";
import { splitByHeadings, splitWithOverlap } from "./splitter.js";

/**
 * Section headings that are keyword/token dumps rather than prose. They embed
 * to near-meaningless vectors and pollute top-k retrieval, so they are never
 * emitted as chunks.
 */
const NON_EMBEDDABLE_SECTIONS = new Set(["Important Vocabulary"]);

/** Minimum meaningful words for a chunk to be worth embedding. */
const MIN_CHUNK_WORDS = 12;

/**
 * Computes a stable SHA-256 hash for chunk text.
 *
 * @param text - Chunk text content
 */
export function hashChunkText(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

/**
 * Detects low-value chunks unfit for retrieval: fragments below the word floor
 * and bullet dumps (mostly short list items, e.g. `- python\n- python3`).
 *
 * @param text - Trimmed chunk text
 * @param wordCount - Whitespace-delimited word count
 */
export function isLowValueChunk(text: string, wordCount: number): boolean {
  if (wordCount < MIN_CHUNK_WORDS) {
    return true;
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length >= 3) {
    const shortBullets = lines.filter(
      (line) => /^[-*]\s/.test(line) && line.split(/\s+/).length <= 3,
    ).length;

    if (shortBullets / lines.length >= 0.6) {
      return true;
    }
  }

  return false;
}

/**
 * Converts a section heading into a filename-safe slug.
 *
 * @param section - Section heading text
 */
export function slugifySection(section: string): string {
  const slug = section
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug.length > 0 ? slug : "section";
}

/**
 * Reads keywords from a knowledge document's metadata.
 *
 * @param knowledge - Source knowledge document
 */
function extractKeywords(knowledge: KnowledgeDocument): readonly string[] {
  const metadata = knowledge.metadata ?? {};
  const keywords = (metadata as Record<string, unknown>).keywords;

  return Array.isArray(keywords)
    ? keywords.filter((keyword): keyword is string => typeof keyword === "string")
    : [];
}

/**
 * Reads source attribution from a knowledge document's metadata.
 *
 * @param knowledge - Source knowledge document
 */
function extractSource(knowledge: KnowledgeDocument): ChunkSourceAttribution {
  const metadata = (knowledge.metadata ?? {}) as Record<string, unknown>;
  const source = (metadata.source ?? {}) as Record<string, unknown>;

  const asString = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;

  return {
    sourceType: asString(source.sourceType),
    sourceUrl: asString(source.sourceUrl),
    rawDocumentId: asString(source.rawDocumentId),
    processedDocumentId: asString(
      source.processedDocumentId,
      knowledge.processedDocumentId,
    ),
    knowledgeDocumentId: knowledge.id,
    title: asString(source.title, knowledge.title),
  };
}

/**
 * Builds chunk documents from a knowledge document.
 *
 * Splits the knowledge markdown by heading, then recursively splits any
 * section exceeding the word limit into overlapping windows. Each chunk keeps
 * persona, topic, section, keywords, source attribution, hash, and text.
 *
 * @param knowledge - Validated knowledge document
 */
export function buildChunkDocuments(
  knowledge: KnowledgeDocument,
): readonly ChunkDocumentInput[] {
  const sections = splitByHeadings(knowledge.content);
  const keywords = extractKeywords(knowledge);
  const source = extractSource(knowledge);
  const createdAt = new Date().toISOString();
  const personaId = knowledge.personaId as PipelinePersonaId;
  const topic = knowledge.topic as Topic;

  const chunks: ChunkDocumentInput[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    if (NON_EMBEDDABLE_SECTIONS.has(section.section)) {
      continue;
    }

    const windows = splitWithOverlap(section.text);

    for (const window of windows) {
      const text = window.trim();

      if (text.length === 0) {
        continue;
      }

      const wordCount = text.split(/\s+/).length;

      if (isLowValueChunk(text, wordCount)) {
        continue;
      }

      const hash = hashChunkText(text);

      chunks.push({
        id: `chunk-${knowledge.id}-${chunkIndex}`,
        personaId,
        knowledgeDocumentId: knowledge.id,
        topic,
        section: section.section,
        chunkIndex,
        text,
        hash,
        keywords: [...keywords],
        source,
        createdAt,
        metadata: {
          language:
            typeof (knowledge.metadata as Record<string, unknown> | undefined)
              ?.language === "string"
              ? (knowledge.metadata as Record<string, unknown>).language
              : "unknown",
          headingDepth: section.depth,
          wordCount,
        },
      });

      chunkIndex += 1;
    }
  }

  return chunks;
}
