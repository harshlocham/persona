import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureDir,
  getChunksDir,
  knowledgeDocumentSchema,
  readJsonFile,
  writeJsonFile,
  chunkDocumentSchema,
  type ChunkDocumentInput,
  type KnowledgeDocument,
  type PipelinePersonaId,
} from "../shared/index.js";
import { buildChunkDocuments, slugifySection } from "./builder.js";

/**
 * Returns the JSON output path for a single chunk.
 *
 * @param personaId - Target persona identifier
 * @param topic - Chunk topic
 * @param baseName - Source document base name (without extension)
 * @param section - Chunk section heading
 * @param chunkIndex - Zero-based chunk index within the document
 */
export function getChunkFilePath(
  personaId: PipelinePersonaId,
  topic: string,
  baseName: string,
  section: string,
  chunkIndex: number,
): string {
  const fileName = `${baseName}.${slugifySection(section)}.${chunkIndex}.json`;
  return path.join(getChunksDir(personaId), topic, fileName);
}

/**
 * Removes previously written chunk files for a document base name.
 *
 * @param topicDir - Absolute topic directory
 * @param baseName - Source document base name
 */
async function removeExistingChunks(
  topicDir: string,
  baseName: string,
): Promise<void> {
  let entries;

  try {
    entries = await fs.readdir(topicDir);
  } catch {
    return;
  }

  const prefix = `${baseName}.`;

  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
      .map((name) => fs.rm(path.join(topicDir, name), { force: true })),
  );
}

/**
 * Result of writing chunks for a single knowledge document.
 */
export interface WriteChunksResult {
  readonly status: "written" | "skipped";
  readonly chunks: number;
}

/**
 * Builds and persists chunk documents from a knowledge document.
 *
 * @param knowledge - Validated knowledge document
 * @param baseName - Source document base name (without extension)
 * @param force - When true, overwrites existing chunk files
 */
export async function writeChunksFromKnowledge(
  knowledge: KnowledgeDocument,
  baseName: string,
  force: boolean,
): Promise<WriteChunksResult> {
  const personaId = knowledge.personaId as PipelinePersonaId;
  const topicDir = path.join(getChunksDir(personaId), knowledge.topic);
  const prefix = `${baseName}.`;

  if (!force) {
    let existing: string[] = [];

    try {
      existing = await fs.readdir(topicDir);
    } catch {
      existing = [];
    }

    const hasExisting = existing.some(
      (name) => name.startsWith(prefix) && name.endsWith(".json"),
    );

    if (hasExisting) {
      return { status: "skipped", chunks: 0 };
    }
  } else {
    await removeExistingChunks(topicDir, baseName);
  }

  const chunks = buildChunkDocuments(knowledge);

  await ensureDir(topicDir);

  await Promise.all(
    chunks.map((chunk: ChunkDocumentInput) => {
      const filePath = getChunkFilePath(
        personaId,
        chunk.topic,
        baseName,
        chunk.section,
        chunk.chunkIndex,
      );

      return writeJsonFile(filePath, chunkDocumentSchema.parse(chunk));
    }),
  );

  return { status: "written", chunks: chunks.length };
}

/**
 * Builds and persists chunks from a knowledge JSON file path.
 *
 * @param knowledgePath - Absolute knowledge document path
 * @param force - When true, overwrites existing chunk files
 */
export async function writeChunksFromKnowledgeFile(
  knowledgePath: string,
  force: boolean,
): Promise<WriteChunksResult> {
  const knowledge = knowledgeDocumentSchema.parse(
    await readJsonFile(knowledgePath),
  );
  const baseName = path.basename(knowledgePath, ".json");

  return writeChunksFromKnowledge(
    knowledge as KnowledgeDocument,
    baseName,
    force,
  );
}
