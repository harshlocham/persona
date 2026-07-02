import fs from "node:fs/promises";
import path from "node:path";

import { getPersonaConfig } from "../config/personas.js";
import {
  chunkDocumentSchema,
  ensurePersonaStorageDirs,
  getChunksDir,
  logger,
  readJsonFile,
  type ChunkDocumentInput,
  type PipelinePersonaId,
} from "../shared/index.js";
import { createEmbedder } from "./embedder.js";
import {
  createQdrantContext,
  ensureCollection,
  ensurePayloadIndexes,
  getExistingPointIds,
  toPointId,
  upsertPoints,
} from "./qdrant.js";
import {
  buildEmbeddingDocument,
  toQdrantPoint,
  writeManifest,
  type EmbeddingManifest,
} from "./writer.js";

/** Number of point IDs checked for existence per Qdrant retrieve call. */
const EXISTENCE_CHECK_BATCH = 256;

/**
 * Options for the embedding pipeline.
 */
export interface EmbedPipelineOptions {
  /** When true, re-embeds chunks even if already indexed. */
  readonly force?: boolean;
}

interface ChunkRef {
  readonly relativePath: string;
  readonly absolutePath: string;
}

/**
 * Recursively discovers chunk JSON documents for a persona.
 *
 * @param personaId - Target persona identifier
 */
export async function discoverChunkDocuments(
  personaId: PipelinePersonaId,
): Promise<readonly ChunkRef[]> {
  const rootDir = getChunksDir(personaId);
  const results: ChunkRef[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries;

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (
        !entry.isFile() ||
        !entry.name.endsWith(".json") ||
        entry.name === "manifest.json"
      ) {
        continue;
      }

      results.push({
        relativePath: path.relative(rootDir, absolutePath),
        absolutePath,
      });
    }
  }

  await walk(rootDir);

  return results.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

/**
 * Splits an array into fixed-size batches.
 *
 * @param items - Items to batch
 * @param size - Maximum batch size
 */
function batch<T>(items: readonly T[], size: number): readonly T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

/**
 * Loads and validates all chunk documents for a persona.
 *
 * @param refs - Discovered chunk references
 */
async function loadChunks(
  refs: readonly ChunkRef[],
): Promise<readonly ChunkDocumentInput[]> {
  const chunks: ChunkDocumentInput[] = [];

  for (const ref of refs) {
    try {
      chunks.push(chunkDocumentSchema.parse(await readJsonFile(ref.absolutePath)));
    } catch (error) {
      logger.error("Skipping invalid chunk document", {
        chunkPath: ref.relativePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return chunks;
}

/**
 * Determines which chunks still need embedding.
 *
 * @param context - Qdrant connection bundle
 * @param chunks - Candidate chunks
 * @param force - When true, all chunks are re-embedded
 */
async function selectPendingChunks(
  context: ReturnType<typeof createQdrantContext>,
  chunks: readonly ChunkDocumentInput[],
  force: boolean,
): Promise<readonly ChunkDocumentInput[]> {
  if (force) {
    return chunks;
  }

  const existing = new Set<string>();
  const idBatches = batch(chunks, EXISTENCE_CHECK_BATCH);

  for (const idBatch of idBatches) {
    const ids = idBatch.map((chunk) => toPointId(chunk.id));
    const found = await getExistingPointIds(context, ids);

    for (const id of found) {
      existing.add(id);
    }
  }

  return chunks.filter((chunk) => !existing.has(toPointId(chunk.id)));
}

/**
 * Runs the embedding stage: embeds chunks and indexes them into Qdrant.
 *
 * @param personaId - Target persona identifier
 * @param options - Pipeline options
 */
export async function runEmbedPipeline(
  personaId: string,
  options: EmbedPipelineOptions = {},
): Promise<EmbeddingManifest> {
  const config = getPersonaConfig(personaId);
  const force = options.force ?? false;
  const startedAt = Date.now();

  await ensurePersonaStorageDirs(config.id);

  const refs = await discoverChunkDocuments(config.id);
  const chunks = await loadChunks(refs);

  logger.info("Discovered chunk documents for embedding", {
    personaId: config.id,
    count: chunks.length,
  });

  const embedder = createEmbedder();
  const context = createQdrantContext();

  await ensureCollection(context, embedder.dimensions);
  await ensurePayloadIndexes(context, ["persona"]);

  const pending = await selectPendingChunks(context, chunks, force);
  const skipped = chunks.length - pending.length;

  logger.info("Prepared embedding work", {
    personaId: config.id,
    collection: context.collection,
    model: embedder.model,
    total: chunks.length,
    pending: pending.length,
    skipped,
    force,
  });

  let embedded = 0;
  let failed = 0;

  const chunkBatches = batch(pending, embedder.batchSize);

  for (const [index, chunkBatch] of chunkBatches.entries()) {
    logger.info("Embedding batch", {
      personaId: config.id,
      progress: `${index + 1}/${chunkBatches.length}`,
      size: chunkBatch.length,
    });

    try {
      const vectors = await embedder.embedBatch(
        chunkBatch.map((chunk) => chunk.text),
      );

      const points = chunkBatch.map((chunk, position) => {
        const embeddingDocument = buildEmbeddingDocument(
          chunk,
          vectors[position],
          embedder.model,
        );

        return toQdrantPoint(chunk, embeddingDocument.embedding, embedder.model);
      });

      await upsertPoints(context, points);
      embedded += points.length;
    } catch (error) {
      failed += chunkBatch.length;
      logger.error("Failed to embed batch", {
        personaId: config.id,
        batch: index + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const manifest: EmbeddingManifest = {
    personaId: config.id,
    collection: context.collection,
    model: embedder.model,
    dimensions: embedder.dimensions,
    totalChunks: chunks.length,
    embedded,
    skipped,
    failed,
    elapsedMs: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  };

  await writeManifest(manifest);

  return manifest;
}
