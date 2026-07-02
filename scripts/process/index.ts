import { getPersonaConfig } from "../config/personas.js";
import {
  ensurePersonaStorageDirs,
  getProcessedDir,
  logger,
} from "../shared/index.js";

/**
 * Process stage — normalizes and structures raw documents.
 *
 * Processing logic is not implemented yet. This stage scaffolds storage only.
 *
 * @param personaId - Target persona identifier
 */
export async function run(personaId: string): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting process stage", {
    stage: "process",
    personaId: config.id,
    displayName: config.displayName,
  });

  await ensurePersonaStorageDirs(config.id);

  logger.info("Process stage complete (no processors implemented)", {
    stage: "process",
    personaId: config.id,
    outputDir: getProcessedDir(config.id),
  });
}
