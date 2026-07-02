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
 * Computes a stable SHA-256 hash for chunk text.
 *
 * @param text - Chunk text content
 */
export function hashChunkText(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
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
    const windows = splitWithOverlap(section.text);

    for (const window of windows) {
      const text = window.trim();

      if (text.length === 0) {
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
          wordCount: text.split(/\s+/).length,
        },
      });

      chunkIndex += 1;
    }
  }

  return chunks;
}
