import path from "node:path";

import { buildKnowledgeDocument } from "./builder.js";
import type { BuiltKnowledgeDocument } from "./types.js";
import {
  ensureDir,
  fileExists,
  getKnowledgeDir,
  knowledgeDocumentSchema,
  processedDocumentSchema,
  readJsonFile,
  writeJsonFile,
  writeMarkdownFile,
  type PipelinePersonaId,
  type ProcessedDocumentInput,
} from "../shared/index.js";

/**
 * Returns the markdown output path for a knowledge document.
 *
 * @param personaId - Target persona identifier
 * @param topic - Knowledge topic
 * @param documentBaseName - File name without extension
 */
export function getKnowledgeMarkdownPath(
  personaId: PipelinePersonaId,
  topic: string,
  documentBaseName: string,
): string {
  return path.join(
    getKnowledgeDir(personaId),
    topic,
    `${documentBaseName}.md`,
  );
}

/**
 * Returns the JSON output path for a knowledge document.
 *
 * @param personaId - Target persona identifier
 * @param topic - Knowledge topic
 * @param documentBaseName - File name without extension
 */
export function getKnowledgeJsonPath(
  personaId: PipelinePersonaId,
  topic: string,
  documentBaseName: string,
): string {
  return path.join(
    getKnowledgeDir(personaId),
    topic,
    `${documentBaseName}.json`,
  );
}

/**
 * Serializes a built knowledge document to the KnowledgeDocument schema.
 *
 * @param built - Built knowledge artifact
 */
export function toKnowledgeDocumentRecord(built: BuiltKnowledgeDocument) {
  return knowledgeDocumentSchema.parse({
    id: built.id,
    personaId: built.personaId,
    processedDocumentId: built.processedDocumentId,
    topic: built.topic,
    title: built.title,
    summary: built.summary,
    content: built.markdown,
    createdAt: built.metadata.createdAt,
    metadata: built.metadata,
  });
}

/**
 * Persists a knowledge artifact as markdown and JSON unless it already exists.
 *
 * @param built - Built knowledge artifact
 * @param documentBaseName - File name without extension
 * @param force - When true, overwrites existing files
 */
export async function writeKnowledgeDocument(
  built: BuiltKnowledgeDocument,
  documentBaseName: string,
  force: boolean,
): Promise<"written" | "skipped"> {
  const markdownPath = getKnowledgeMarkdownPath(
    built.personaId,
    built.topic,
    documentBaseName,
  );
  const jsonPath = getKnowledgeJsonPath(
    built.personaId,
    built.topic,
    documentBaseName,
  );

  if (!force && (await fileExists(markdownPath))) {
    return "skipped";
  }

  await ensureDir(path.dirname(markdownPath));
  await writeMarkdownFile(markdownPath, built.markdown);
  await writeJsonFile(jsonPath, toKnowledgeDocumentRecord(built));

  return "written";
}

/**
 * Builds and writes a knowledge artifact from a processed document file.
 *
 * @param processed - Validated processed document
 * @param documentBaseName - File name without extension
 * @param force - When true, overwrites existing files
 */
export async function writeKnowledgeFromProcessed(
  processed: ProcessedDocumentInput,
  documentBaseName: string,
  force: boolean,
): Promise<"written" | "skipped"> {
  const built = buildKnowledgeDocument(processed);
  return writeKnowledgeDocument(built, documentBaseName, force);
}

/**
 * Builds and writes a knowledge artifact from a processed JSON file path.
 *
 * @param processedPath - Absolute processed document path
 * @param force - When true, overwrites existing files
 */
export async function writeKnowledgeFromProcessedFile(
  processedPath: string,
  force: boolean,
): Promise<"written" | "skipped"> {
  const processed = processedDocumentSchema.parse(
    await readJsonFile(processedPath),
  );
  const documentBaseName = path.basename(processedPath, ".json");

  return writeKnowledgeFromProcessed(processed, documentBaseName, force);
}
