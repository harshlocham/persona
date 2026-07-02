import { getPersonaConfig } from "../config/personas.js";
import { runYouTubeCollector } from "./youtube/collector.js";
import {
  ensurePersonaStorageDirs,
  logger,
} from "../shared/index.js";

/**
 * Options for the collect stage.
 */
export interface CollectOptions {
  /** When true, overwrites existing raw documents. */
  readonly force?: boolean;
}

/**
 * Collect stage — gathers raw documents from configured public sources.
 *
 * @param personaId - Target persona identifier
 * @param options - Collect stage options
 */
export async function run(
  personaId: string,
  options: CollectOptions = {},
): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting collect stage", {
    stage: "collect",
    personaId: config.id,
    displayName: config.displayName,
    force: options.force ?? false,
  });

  await ensurePersonaStorageDirs(config.id);

  await runYouTubeCollector(personaId, { force: options.force });

  logger.info("Collect stage complete", {
    stage: "collect",
    personaId: config.id,
    configuredSources: {
      websites: config.sources.websites.length,
      youtubeChannels: config.sources.youtubeChannels.length,
      youtubePlaylists: config.sources.youtubePlaylists.length,
      blogs: config.sources.blogs.length,
    },
  });
}
