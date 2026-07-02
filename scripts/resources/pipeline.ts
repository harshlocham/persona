import fs from "node:fs/promises";
import path from "node:path";

import { getPersonaConfig } from "../config/personas.js";
import {
  ensurePersonaStorageDirs,
  getEmbeddingEnv,
  getRawDir,
  logger,
  rawDocumentSchema,
  readJsonFile,
  type ResourceRecordInput,
} from "../shared/index.js";
import { createEmbedder } from "../embed/embedder.js";
import {
  createQdrantContext,
  ensureCollection,
  ensurePayloadIndexes,
  getExistingPointIds,
  toPointId,
  upsertPoints,
} from "../embed/qdrant.js";
import { buildResourceRecord } from "./builder.js";
import { buildCourseRecords } from "./courses.js";
import {
  buildResourceEmbeddingText,
  toResourceQdrantPoint,
  writeResourceRecord,
} from "./writer.js";

const YOUTUBE_SUBDIR = "youtube";

/**
 * Options for the resources pipeline.
 */
export interface ResourcesPipelineOptions {
  /** When true, re-embeds resources even if already indexed. */
  readonly force?: boolean;
  /**
   * When true, only derives and writes the catalog to storage and skips
   * embedding entirely. Useful for regenerating the on-disk catalog without
   * consuming embedding API quota.
   */
  readonly buildOnly?: boolean;
}

/**
 * Summary of a resources pipeline run.
 */
export interface ResourcesManifest {
  readonly personaId: string;
  readonly collection: string;
  readonly model: string;
  readonly built: number;
  readonly embedded: number;
  readonly failed: number;
  readonly elapsedMs: number;
  readonly generatedAt: string;
}

/**
 * Loads and validates collected YouTube raw documents for a persona.
 *
 * @param personaId - Target persona identifier
 */
async function loadYouTubeRawDocuments(
  personaId: ResourceRecordInput["personaId"],
): Promise<ReturnType<typeof rawDocumentSchema.parse>[]> {
  const youtubeDir = path.join(getRawDir(personaId), YOUTUBE_SUBDIR);

  let entries: string[];
  try {
    entries = await fs.readdir(youtubeDir);
  } catch {
    return [];
  }

  const docs: ReturnType<typeof rawDocumentSchema.parse>[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json") || entry === "index.json") {
      continue;
    }

    try {
      const raw = rawDocumentSchema.parse(
        await readJsonFile(path.join(youtubeDir, entry)),
      );
      docs.push(raw);
    } catch (error) {
      logger.warn("Skipping invalid raw document", {
        file: entry,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return docs;
}

/**
 * Splits an array into fixed-size batches.
 */
function batch<T>(items: readonly T[], size: number): readonly T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/** Number of point IDs checked for existence per Qdrant retrieve call. */
const EXISTENCE_CHECK_BATCH = 256;

/**
 * Returns records not yet indexed in the resources collection.
 */
async function selectPending(
  context: ReturnType<typeof createQdrantContext>,
  records: readonly ResourceRecordInput[],
): Promise<readonly ResourceRecordInput[]> {
  const existing = new Set<string>();

  for (const idBatch of batch(records, EXISTENCE_CHECK_BATCH)) {
    const ids = idBatch.map((record) => toPointId(record.id));
    const found = await getExistingPointIds(context, ids);
    for (const id of found) {
      existing.add(id);
    }
  }

  return records.filter((record) => !existing.has(toPointId(record.id)));
}

/**
 * Runs the resources stage: derives a resource catalog from collected YouTube
 * data, writes it to storage, and indexes it into the resources collection.
 *
 * @param personaId - Target persona identifier
 * @param options - Pipeline options
 */
export async function runResourcesPipeline(
  personaId: string,
  options: ResourcesPipelineOptions = {},
): Promise<ResourcesManifest> {
  const config = getPersonaConfig(personaId);
  const force = options.force ?? false;
  const buildOnly = options.buildOnly ?? false;
  const startedAt = Date.now();

  await ensurePersonaStorageDirs(config.id);

  const rawDocs = await loadYouTubeRawDocuments(config.id);

  const videoRecords: ResourceRecordInput[] = [];
  for (const raw of rawDocs) {
    const record = buildResourceRecord(raw);
    if (record) {
      videoRecords.push(record);
    }
  }

  const courseRecords = buildCourseRecords(config.id);

  // Courses first so the small, high-value course set is embedded before large
  // video batches (which can be throttled by the embedding quota).
  const records: ResourceRecordInput[] = [...courseRecords, ...videoRecords];

  for (const record of records) {
    await writeResourceRecord(record);
  }

  logger.info("Built resource catalog", {
    personaId: config.id,
    built: records.length,
    videos: videoRecords.length,
    courses: courseRecords.length,
  });

  if (buildOnly) {
    logger.info("Skipping resource embedding (build-only)", {
      personaId: config.id,
      built: records.length,
    });

    return {
      personaId: config.id,
      collection: "",
      model: "",
      built: records.length,
      embedded: 0,
      failed: 0,
      elapsedMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    };
  }

  const env = getEmbeddingEnv();
  const embedder = createEmbedder();
  const context = { ...createQdrantContext(), collection: env.RESOURCES_COLLECTION };

  await ensureCollection(context, embedder.dimensions);
  await ensurePayloadIndexes(context, ["persona", "type"]);

  const pending = force ? records : await selectPending(context, records);

  logger.info("Prepared resource embedding work", {
    personaId: config.id,
    collection: context.collection,
    total: records.length,
    pending: pending.length,
    force,
  });

  let embedded = 0;
  let failed = 0;

  const recordBatches = batch(pending, embedder.batchSize);

  for (const [index, recordBatch] of recordBatches.entries()) {
    logger.info("Embedding resource batch", {
      personaId: config.id,
      progress: `${index + 1}/${recordBatches.length}`,
      size: recordBatch.length,
    });

    try {
      const vectors = await embedder.embedBatch(
        recordBatch.map((record) => buildResourceEmbeddingText(record)),
      );

      const points = recordBatch.map((record, position) =>
        toResourceQdrantPoint(record, vectors[position], embedder.model),
      );

      await upsertPoints(context, points);
      embedded += points.length;
    } catch (error) {
      failed += recordBatch.length;
      logger.error("Failed to embed resource batch", {
        personaId: config.id,
        batch: index + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    personaId: config.id,
    collection: context.collection,
    model: embedder.model,
    built: records.length,
    embedded,
    failed,
    elapsedMs: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  };
}
