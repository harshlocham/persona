import type { PersonaPipelineConfig } from "../../config/personas.js";
import { getPersonaConfig } from "../../config/personas.js";
import {
  ensurePersonaStorageDirs,
  logger,
  readJsonFile,
  sleep,
} from "../../shared/index.js";
import { discoverYouTubeVideos } from "./discovery.js";
import {
  getYouTubeDocumentPath,
  saveYouTubeRawDocument,
  writeYouTubeIndex,
} from "./storage.js";
import { fetchYouTubeTranscript } from "./transcript.js";
import type {
  YouTubeCollectorOptions,
  YouTubeCollectorSummary,
} from "./types.js";

const TRANSCRIPT_DELAY_MS = 250;

/**
 * Collects YouTube metadata and transcripts for a persona's configured sources.
 *
 * @param config - Persona pipeline configuration
 * @param options - Collector options
 */
export async function collectYouTubeForPersona(
  config: PersonaPipelineConfig,
  options: YouTubeCollectorOptions = {},
): Promise<YouTubeCollectorSummary> {
  const force = options.force ?? false;
  const sources = [
    ...config.sources.youtubeChannels,
    ...config.sources.youtubePlaylists,
  ];

  if (sources.length === 0) {
    logger.warn("No YouTube channels or playlists configured", {
      personaId: config.id,
    });

    await writeYouTubeIndex(config, []);
    return {
      discovered: 0,
      written: 0,
      skipped: 0,
      withoutTranscript: 0,
      failed: 0,
    };
  }

  logger.info("Discovering YouTube videos", {
    personaId: config.id,
    sourceCount: sources.length,
  });

  const videos = await discoverYouTubeVideos(sources);

  logger.info("YouTube discovery complete", {
    personaId: config.id,
    discovered: videos.length,
  });

  const summary = {
    discovered: videos.length,
    written: 0,
    skipped: 0,
    withoutTranscript: 0,
    failed: 0,
  } satisfies YouTubeCollectorSummary;

  const indexEntries: Array<{
    videoId: string;
    title: string;
    url: string;
    fileName: string;
    hasTranscript: boolean;
    collectedAt: string;
  }> = [];

  for (const [index, video] of videos.entries()) {
    logger.info("Collecting YouTube video", {
      personaId: config.id,
      progress: `${index + 1}/${videos.length}`,
      videoId: video.videoId,
      title: video.title,
    });

    try {
      const transcript = await fetchYouTubeTranscript(video.videoId);
      const result = await saveYouTubeRawDocument(
        config,
        video,
        transcript,
        force,
      );

      if (result.skipped) {
        summary.skipped += 1;
        logger.info("Skipped existing YouTube document", {
          videoId: video.videoId,
          file: getYouTubeDocumentPath(config.id, video.videoId),
        });

        const existing = await readJsonFile<{
          collectedAt: string;
          metadata?: { hasTranscript?: boolean };
        }>(getYouTubeDocumentPath(config.id, video.videoId));

        indexEntries.push({
          videoId: video.videoId,
          title: video.title,
          url: video.url,
          fileName: result.fileName,
          hasTranscript: existing.metadata?.hasTranscript ?? false,
          collectedAt: existing.collectedAt,
        });
        continue;
      }

      summary.written += 1;

      if (!result.hasTranscript) {
        summary.withoutTranscript += 1;
      }

      indexEntries.push({
        videoId: video.videoId,
        title: video.title,
        url: video.url,
        fileName: result.fileName,
        hasTranscript: result.hasTranscript,
        collectedAt: new Date().toISOString(),
      });
    } catch (error) {
      summary.failed += 1;
      logger.error("Failed to collect YouTube video", {
        videoId: video.videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (index < videos.length - 1) {
      await sleep(TRANSCRIPT_DELAY_MS);
    }
  }

  await writeYouTubeIndex(config, indexEntries);

  return summary;
}

/**
 * Runs the YouTube collector for a persona ID.
 *
 * @param personaId - Target persona identifier
 * @param options - Collector options
 */
export async function runYouTubeCollector(
  personaId: string,
  options: YouTubeCollectorOptions = {},
): Promise<YouTubeCollectorSummary> {
  const config = getPersonaConfig(personaId);

  await ensurePersonaStorageDirs(config.id);

  logger.info("Starting YouTube collector", {
    personaId: config.id,
    displayName: config.displayName,
    force: options.force ?? false,
    channels: config.sources.youtubeChannels.length,
    playlists: config.sources.youtubePlaylists.length,
  });

  const summary = await collectYouTubeForPersona(config, options);

  logger.info("YouTube collector complete", {
    personaId: config.id,
    ...summary,
  });

  return summary;
}
