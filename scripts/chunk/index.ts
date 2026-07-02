import { getPersonaConfig } from "../config/personas.js";
import { getChunksDir, logger } from "../shared/index.js";
import {
  runChunkPipeline,
  type ChunkPipelineOptions,
} from "./pipeline.js";

export type { ChunkPipelineOptions, ChunkPipelineSummary } from "./pipeline.js";
export { discoverKnowledgeDocuments } from "./pipeline.js";
export {
  buildChunkDocuments,
  hashChunkText,
  slugifySection,
} from "./builder.js";
export {
  countWords,
  splitByHeadings,
  splitWithOverlap,
  stripFrontmatter,
  CHUNK_OVERLAP_WORDS,
  MAX_CHUNK_WORDS,
  type MarkdownSection,
} from "./splitter.js";
export {
  getChunkFilePath,
  writeChunksFromKnowledge,
  writeChunksFromKnowledgeFile,
  type WriteChunksResult,
} from "./writer.js";

/**
 * Options for the chunk stage.
 */
export interface ChunkOptions extends ChunkPipelineOptions {}

/**
 * Chunk stage — splits knowledge documents into retrieval-ready chunks.
 *
 * @param personaId - Target persona identifier
 * @param options - Chunk stage options
 */
export async function run(
  personaId: string,
  options: ChunkOptions = {},
): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting chunk stage", {
    stage: "chunk",
    personaId: config.id,
    displayName: config.displayName,
    force: options.force ?? false,
  });

  const summary = await runChunkPipeline(personaId, options);

  logger.info("Chunk stage complete", {
    stage: "chunk",
    personaId: config.id,
    outputDir: getChunksDir(config.id),
    ...summary,
  });
}
