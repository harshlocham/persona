import { getPersonaConfig } from "../config/personas.js";
import { getEmbeddingsDir, logger } from "../shared/index.js";
import {
  runEmbedPipeline,
  type EmbedPipelineOptions,
} from "./pipeline.js";

export type { EmbedPipelineOptions } from "./pipeline.js";
export { discoverChunkDocuments } from "./pipeline.js";
export { createEmbedder, type Embedder } from "./embedder.js";
export {
  createQdrantContext,
  ensureCollection,
  getExistingPointIds,
  toPointId,
  upsertPoints,
  type QdrantContext,
  type QdrantPoint,
} from "./qdrant.js";
export {
  buildEmbeddingDocument,
  getManifestPath,
  toQdrantPoint,
  writeManifest,
  type EmbeddingManifest,
} from "./writer.js";

/**
 * Options for the embed stage.
 */
export interface EmbedOptions extends EmbedPipelineOptions {}

/**
 * Embed stage — converts chunks into embeddings and indexes them into Qdrant.
 *
 * @param personaId - Target persona identifier
 * @param options - Embed stage options
 */
export async function run(
  personaId: string,
  options: EmbedOptions = {},
): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting embed stage", {
    stage: "embed",
    personaId: config.id,
    displayName: config.displayName,
    force: options.force ?? false,
  });

  const manifest = await runEmbedPipeline(personaId, options);

  logger.info("Embed stage complete", {
    stage: "embed",
    personaId: config.id,
    outputDir: getEmbeddingsDir(config.id),
    collection: manifest.collection,
    model: manifest.model,
    totalChunks: manifest.totalChunks,
    embedded: manifest.embedded,
    skipped: manifest.skipped,
    failed: manifest.failed,
    elapsedMs: manifest.elapsedMs,
  });
}
