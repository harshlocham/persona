import { getPersonaConfig } from "../config/personas.js";
import {
  ensurePersonaStorageDirs,
  getKnowledgeDir,
  logger,
} from "../shared/index.js";

/**
 * Summarize stage — produces knowledge artifacts from processed documents.
 *
 * Summarization logic is not implemented yet. This stage scaffolds storage only.
 *
 * @param personaId - Target persona identifier
 */
export async function run(personaId: string): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting summarize stage", {
    stage: "summarize",
    personaId: config.id,
    displayName: config.displayName,
  });

  await ensurePersonaStorageDirs(config.id);

  logger.info("Summarize stage complete (no summarizers implemented)", {
    stage: "summarize",
    personaId: config.id,
    outputDir: getKnowledgeDir(config.id),
  });
}
