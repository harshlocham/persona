import { logger } from "../../shared/index.js";

interface TranscriptSegment {
  readonly text: string;
}

/**
 * Fetches publicly available captions for a YouTube video when present.
 *
 * @param videoId - YouTube video identifier
 * @returns Transcript text or `null` when captions are unavailable
 */
export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");

    const segments = (await YoutubeTranscript.fetchTranscript(
      videoId,
    )) as TranscriptSegment[];

    const text = segments
      .map((segment) => segment.text.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    return text.length > 0 ? text : null;
  } catch (error) {
    logger.warn("Transcript unavailable for video", {
      videoId,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}
