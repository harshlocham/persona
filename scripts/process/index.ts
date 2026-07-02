import { getPersonaConfig } from "../config/personas.js";
import {
  ensurePersonaStorageDirs,
  getProcessedDir,
  logger,
} from "../shared/index.js";
import { runProcessPipeline, type ProcessPipelineOptions } from "./pipeline.js";

export type { ProcessPipelineOptions, ProcessPipelineSummary } from "./pipeline.js";
export { cleanContent, type CleaningResult, type CleaningStats } from "./cleaner.js";
export {
  classifyContent,
  type ClassificationResult,
} from "./classifier.js";
export { normalizeContent } from "./normalize.js";
export {
  discoverRawDocuments,
  getProcessedDocumentPath,
  processRawDocumentFile,
  runProcessPipeline,
  transformRawDocument,
} from "./pipeline.js";

/**
 * Options for the process stage.
 */
export interface ProcessOptions extends ProcessPipelineOptions {}

/**
 * Process stage — converts raw documents into processed documents.
 *
 * @param personaId - Target persona identifier
 * @param options - Process stage options
 */
export async function run(
  personaId: string,
  options: ProcessOptions = {},
): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting process stage", {
    stage: "process",
    personaId: config.id,
    displayName: config.displayName,
    force: options.force ?? false,
  });

  await ensurePersonaStorageDirs(config.id);

  const summary = await runProcessPipeline(personaId, options);

  logger.info("Process stage complete", {
    stage: "process",
    personaId: config.id,
    outputDir: getProcessedDir(config.id),
    ...summary,
  });
}
