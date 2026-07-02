import path from "node:path";

import {
  embeddingDocumentSchema,
  getEmbeddingsDir,
  writeJsonFile,
  type ChunkDocumentInput,
  type EmbeddingDocumentInput,
  type PipelinePersonaId,
} from "../shared/index.js";
import type { QdrantPoint } from "./qdrant.js";
import { toPointId } from "./qdrant.js";

/**
 * Builds a validated EmbeddingDocument from a chunk and its vector.
 *
 * @param chunk - Source chunk document
 * @param embedding - Embedding vector for the chunk text
 * @param model - Embedding model identifier
 */
export function buildEmbeddingDocument(
  chunk: ChunkDocumentInput,
  embedding: number[],
  model: string,
): EmbeddingDocumentInput {
  return embeddingDocumentSchema.parse({
    id: `embedding-${chunk.id}`,
    personaId: chunk.personaId,
    knowledgeDocumentId: chunk.knowledgeDocumentId,
    topic: chunk.topic,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    embedding,
    model,
    createdAt: new Date().toISOString(),
    metadata: {
      chunkId: chunk.id,
      section: chunk.section,
      keywords: chunk.keywords,
      source: chunk.source,
      hash: chunk.hash,
    },
  });
}

/**
 * Maps a chunk and its vector into a Qdrant point.
 *
 * The payload carries all fields required for later filtering and display:
 * persona, topic, section, keywords, source, text, and hash.
 *
 * @param chunk - Source chunk document
 * @param embedding - Embedding vector for the chunk text
 * @param model - Embedding model identifier
 */
export function toQdrantPoint(
  chunk: ChunkDocumentInput,
  embedding: number[],
  model: string,
): QdrantPoint {
  return {
    id: toPointId(chunk.id),
    vector: embedding,
    payload: {
      chunkId: chunk.id,
      knowledgeDocumentId: chunk.knowledgeDocumentId,
      persona: chunk.personaId,
      topic: chunk.topic,
      section: chunk.section,
      keywords: chunk.keywords,
      source: chunk.source,
      text: chunk.text,
      hash: chunk.hash,
      model,
    },
  };
}

/**
 * Summary of an embedding run persisted to the manifest.
 */
export interface EmbeddingManifest {
  readonly personaId: string;
  readonly collection: string;
  readonly model: string;
  readonly dimensions: number;
  readonly totalChunks: number;
  readonly embedded: number;
  readonly skipped: number;
  readonly failed: number;
  readonly elapsedMs: number;
  readonly generatedAt: string;
}

/**
 * Returns the manifest path for a persona's embeddings.
 *
 * @param personaId - Target persona identifier
 */
export function getManifestPath(personaId: PipelinePersonaId): string {
  return path.join(getEmbeddingsDir(personaId), "manifest.json");
}

/**
 * Writes the embedding manifest summarizing the run.
 *
 * @param manifest - Manifest payload
 */
export async function writeManifest(
  manifest: EmbeddingManifest,
): Promise<void> {
  const personaId = manifest.personaId as PipelinePersonaId;
  await writeJsonFile(getManifestPath(personaId), manifest);
}
