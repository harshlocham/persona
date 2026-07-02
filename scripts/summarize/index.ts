import { getPersonaConfig } from "../config/personas.js";
import {
  ensurePersonaStorageDirs,
  getKnowledgeDir,
  logger,
} from "../shared/index.js";
import {
  runKnowledgePipeline,
  type KnowledgePipelineOptions,
} from "../knowledge/pipeline.js";

export type { KnowledgePipelineOptions, KnowledgePipelineSummary } from "../knowledge/pipeline.js";
export {
  buildKnowledgeDocument,
  buildKnowledgeSections,
  buildSourceAttribution,
  splitIntoSentences,
} from "../knowledge/builder.js";
export { renderKnowledgeMarkdown, renderKnowledgeFrontmatter } from "../knowledge/templates.js";
export {
  getKnowledgeJsonPath,
  getKnowledgeMarkdownPath,
  toKnowledgeDocumentRecord,
  writeKnowledgeDocument,
  writeKnowledgeFromProcessed,
  writeKnowledgeFromProcessedFile,
} from "../knowledge/writer.js";
export type {
  BuiltKnowledgeDocument,
  KnowledgeDocumentMetadata,
  KnowledgeSections,
  KnowledgeSourceAttribution,
} from "../knowledge/types.js";

/**
 * Options for the summarize stage.
 */
export interface SummarizeOptions extends KnowledgePipelineOptions {}

/**
 * Summarize stage — generates structured knowledge documents from processed input.
 *
 * @param personaId - Target persona identifier
 * @param options - Summarize stage options
 */
export async function run(
  personaId: string,
  options: SummarizeOptions = {},
): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting summarize stage", {
    stage: "summarize",
    personaId: config.id,
    displayName: config.displayName,
    force: options.force ?? false,
  });

  await ensurePersonaStorageDirs(config.id);

  const summary = await runKnowledgePipeline(personaId, options);

  logger.info("Summarize stage complete", {
    stage: "summarize",
    personaId: config.id,
    outputDir: getKnowledgeDir(config.id),
    ...summary,
  });
}
