import path from "node:path";

import type { PersonaPipelineConfig } from "../../config/personas.js";
import {
  ensureDir,
  fileExists,
  getRawDir,
  rawDocumentSchema,
  readJsonFile,
  writeJsonFile,
  youtubeCollectionIndexSchema,
  type RawDocumentInput,
  type YouTubeCollectionIndex,
  type YouTubeVideoMetadata,
} from "../../shared/index.js";
import type { YouTubeCollectionResult } from "./types.js";

const YOUTUBE_SUBDIR = "youtube";

/**
 * Returns the YouTube raw storage directory for a persona.
 *
 * @param personaId - Target persona identifier
 */
export function getYouTubeRawDir(personaId: PersonaPipelineConfig["id"]): string {
  return path.join(getRawDir(personaId), YOUTUBE_SUBDIR);
}

/**
 * Returns the file path for a YouTube raw document.
 *
 * @param personaId - Target persona identifier
 * @param videoId - YouTube video identifier
 */
export function getYouTubeDocumentPath(
  personaId: PersonaPipelineConfig["id"],
  videoId: string,
): string {
  return path.join(getYouTubeRawDir(personaId), `${videoId}.json`);
}

/**
 * Returns the index file path for collected YouTube videos.
 *
 * @param personaId - Target persona identifier
 */
export function getYouTubeIndexPath(
  personaId: PersonaPipelineConfig["id"],
): string {
  return path.join(getYouTubeRawDir(personaId), "index.json");
}

/**
 * Builds a {@link RawDocument} from YouTube metadata and optional transcript.
 *
 * @param config - Persona pipeline configuration
 * @param video - YouTube video metadata
 * @param transcript - Optional transcript text
 */
export function buildYouTubeRawDocument(
  config: PersonaPipelineConfig,
  video: YouTubeVideoMetadata,
  transcript: string | null,
): RawDocumentInput {
  const hasTranscript = Boolean(transcript && transcript.length > 0);
  const content = hasTranscript ? transcript! : video.description;

  return rawDocumentSchema.parse({
    id: `youtube-${video.videoId}`,
    personaId: config.id,
    sourceType: "youtube",
    sourceUrl: video.url,
    title: video.title,
    content,
    collectedAt: new Date().toISOString(),
    metadata: {
      videoId: video.videoId,
      description: video.description,
      publishedAt: video.publishedAt,
      duration: video.duration,
      hasTranscript,
      channelId: video.channelId,
      playlistId: video.playlistId,
    },
  });
}

/**
 * Persists a validated YouTube raw document unless the file already exists.
 *
 * @param config - Persona pipeline configuration
 * @param video - YouTube video metadata
 * @param transcript - Optional transcript text
 * @param force - When true, overwrites existing files
 */
export async function saveYouTubeRawDocument(
  config: PersonaPipelineConfig,
  video: YouTubeVideoMetadata,
  transcript: string | null,
  force: boolean,
): Promise<YouTubeCollectionResult> {
  const filePath = getYouTubeDocumentPath(config.id, video.videoId);
  const fileName = path.basename(filePath);
  const hasTranscript = Boolean(transcript && transcript.length > 0);

  if (!force && (await fileExists(filePath))) {
    return {
      videoId: video.videoId,
      fileName,
      hasTranscript,
      skipped: true,
    };
  }

  const document = buildYouTubeRawDocument(config, video, transcript);
  await writeJsonFile(filePath, document);

  return {
    videoId: video.videoId,
    fileName,
    hasTranscript,
    skipped: false,
  };
}

/**
 * Writes the YouTube collection index for a persona.
 *
 * @param config - Persona pipeline configuration
 * @param entries - Collected video index entries
 */
export async function writeYouTubeIndex(
  config: PersonaPipelineConfig,
  entries: YouTubeCollectionIndex["videos"],
): Promise<void> {
  const index = youtubeCollectionIndexSchema.parse({
    personaId: config.id,
    source: "youtube",
    updatedAt: new Date().toISOString(),
    videos: entries,
  });

  await ensureDir(getYouTubeRawDir(config.id));
  await writeJsonFile(getYouTubeIndexPath(config.id), index);
}
