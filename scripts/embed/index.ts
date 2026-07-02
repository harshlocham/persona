import { getPersonaConfig } from "../config/personas.js";
import {
  ensurePersonaStorageDirs,
  getEmbeddingsDir,
  logger,
} from "../shared/index.js";

/**
 * Embed stage — generates vector embeddings from knowledge documents.
 *
 * Embedding logic is not implemented yet. This stage scaffolds storage only.
 *
 * @param personaId - Target persona identifier
 */
export async function run(personaId: string): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting embed stage", {
    stage: "embed",
    personaId: config.id,
    displayName: config.displayName,
  });

  await ensurePersonaStorageDirs(config.id);

  logger.info("Embed stage complete (no embedders implemented)", {
    stage: "embed",
    personaId: config.id,
    outputDir: getEmbeddingsDir(config.id),
  });
}
