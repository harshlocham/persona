import path from "node:path";

import {
  getResourcesDir,
  writeJsonFile,
  type ResourceRecordInput,
} from "../shared/index.js";
import { toPointId, type QdrantPoint } from "../embed/qdrant.js";

/**
 * Returns the catalog file path for a resource record.
 *
 * @param record - Resource record
 */
export function getResourceFilePath(record: ResourceRecordInput): string {
  return path.join(getResourcesDir(record.personaId), `${record.id}.json`);
}

/**
 * Persists a resource record to the resources storage stage.
 *
 * @param record - Resource record to write
 */
export async function writeResourceRecord(
  record: ResourceRecordInput,
): Promise<void> {
  await writeJsonFile(getResourceFilePath(record), record);
}

/**
 * Builds the text embedded for a resource. Combines the fields a learner would
 * search by: title, summary, and topics.
 *
 * @param record - Resource record
 */
export function buildResourceEmbeddingText(record: ResourceRecordInput): string {
  return [
    record.title,
    record.summary,
    `Topics: ${record.topics.join(", ")}`,
    `Difficulty: ${record.difficulty}`,
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

/**
 * Maps a resource record and its vector into a Qdrant point. The payload
 * carries every field needed for filtering and display at retrieval time.
 *
 * @param record - Resource record
 * @param embedding - Embedding vector for the resource text
 * @param model - Embedding model identifier
 */
export function toResourceQdrantPoint(
  record: ResourceRecordInput,
  embedding: number[],
  model: string,
): QdrantPoint {
  return {
    id: toPointId(record.id),
    vector: embedding,
    payload: {
      resourceId: record.id,
      persona: record.personaId,
      title: record.title,
      type: record.type,
      url: record.url,
      topics: record.topics,
      difficulty: record.difficulty,
      durationMinutes: record.durationMinutes ?? null,
      publishedAt: record.publishedAt ?? null,
      summary: record.summary,
      model,
    },
  };
}
