import { getPersonaConfig } from "../config/personas.js";
import { getResourcesDir, logger } from "../shared/index.js";
import {
  runResourcesPipeline,
  type ResourcesPipelineOptions,
} from "./pipeline.js";

export type { ResourcesManifest, ResourcesPipelineOptions } from "./pipeline.js";
export { buildResourceRecord, parseIsoDurationMinutes } from "./builder.js";
export {
  buildResourceEmbeddingText,
  toResourceQdrantPoint,
  writeResourceRecord,
} from "./writer.js";

/**
 * Options for the resources stage.
 */
export interface ResourcesOptions extends ResourcesPipelineOptions {}

/**
 * Resources stage — derives a persona resource catalog from collected data and
 * indexes it into the resources collection for grounded recommendations.
 *
 * @param personaId - Target persona identifier
 * @param options - Resources stage options
 */
export async function run(
  personaId: string,
  options: ResourcesOptions = {},
): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting resources stage", {
    stage: "resources",
    personaId: config.id,
    displayName: config.displayName,
    force: options.force ?? false,
  });

  const manifest = await runResourcesPipeline(personaId, options);

  logger.info("Resources stage complete", {
    stage: "resources",
    personaId: config.id,
    outputDir: getResourcesDir(config.id),
    collection: manifest.collection,
    built: manifest.built,
    embedded: manifest.embedded,
    failed: manifest.failed,
    elapsedMs: manifest.elapsedMs,
  });
}
