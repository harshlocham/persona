import { getYoutubeApiKey } from "../../shared/env.js";
import {
  createRateLimiter,
  logger,
  sleep,
  youtubeVideoMetadataSchema,
  type RateLimiter,
  type YouTubeVideoMetadata,
} from "../../shared/index.js";
import type { YouTubeSourceRef } from "./types.js";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const DEFAULT_PAGE_SIZE = 50;
const MAX_RETRIES = 3;

interface YouTubeApiListResponse<T> {
  readonly items?: readonly T[];
  readonly nextPageToken?: string;
}

interface YouTubeChannelItem {
  readonly id: string;
  readonly contentDetails?: {
    readonly relatedPlaylists?: {
      readonly uploads?: string;
    };
  };
}

interface YouTubePlaylistItem {
  readonly snippet?: {
    readonly title?: string;
    readonly description?: string;
    readonly publishedAt?: string;
    readonly resourceId?: {
      readonly videoId?: string;
    };
  };
  readonly contentDetails?: {
    readonly videoId?: string;
  };
}

interface YouTubeVideoItem {
  readonly id: string;
  readonly snippet?: {
    readonly title?: string;
    readonly description?: string;
    readonly publishedAt?: string;
    readonly channelId?: string;
  };
  readonly contentDetails?: {
    readonly duration?: string;
  };
}

/**
 * Parses a configured YouTube channel, handle, or playlist reference.
 *
 * @param value - Channel ID, handle, URL, or playlist reference
 */
export function parseYouTubeSource(value: string): YouTubeSourceRef {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("YouTube source value cannot be empty.");
  }

  const playlistMatch = trimmed.match(/(?:list=)([a-zA-Z0-9_-]+)/);
  if (playlistMatch?.[1]) {
    return { kind: "playlist", playlistId: playlistMatch[1] };
  }

  const barePlaylist = trimmed.split(/[&?#]/)[0] ?? trimmed;
  if (/^PL[\w-]+$/.test(barePlaylist)) {
    return { kind: "playlist", playlistId: barePlaylist };
  }

  const handleMatch = trimmed.match(/(?:youtube\.com\/@|@)([\w.-]+)/);
  if (handleMatch?.[1]) {
    return { kind: "handle", handle: handleMatch[1] };
  }

  const channelMatch = trimmed.match(
    /(?:youtube\.com\/channel\/)(UC[\w-]+)/,
  );
  if (channelMatch?.[1]) {
    return { kind: "channel", channelId: channelMatch[1] };
  }

  if (/^UC[\w-]+$/.test(trimmed)) {
    return { kind: "channel", channelId: trimmed };
  }

  throw new Error(
    `Unsupported YouTube source format: "${value}". Use a channel ID, @handle, channel URL, or playlist URL/ID.`,
  );
}

/**
 * Builds a canonical YouTube watch URL for a video ID.
 *
 * @param videoId - YouTube video identifier
 */
export function buildYouTubeVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function fetchYouTubeApi<T>(
  path: string,
  params: Record<string, string>,
  rateLimiter: RateLimiter,
): Promise<T> {
  const apiKey = getYoutubeApiKey();
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("key", apiKey);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await rateLimiter.schedule(() => fetch(url));

      if (response.status === 429) {
        const backoffMs = attempt * 1_000;
        logger.warn("YouTube API rate limit hit; backing off", {
          attempt,
          backoffMs,
        });
        await sleep(backoffMs);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `YouTube API request failed (${response.status}): ${body}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }

      const backoffMs = attempt * 500;
      logger.warn("YouTube API request failed; retrying", {
        attempt,
        backoffMs,
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(backoffMs);
    }
  }

  throw new Error("YouTube API request failed after retries.");
}

/**
 * Resolves a channel uploads playlist ID from a source reference.
 *
 * @param source - Parsed YouTube source
 * @param rateLimiter - Shared API rate limiter
 */
export async function resolveUploadsPlaylistId(
  source: YouTubeSourceRef,
  rateLimiter: RateLimiter,
): Promise<string> {
  if (source.kind === "playlist") {
    return source.playlistId;
  }

  const params: Record<string, string> =
    source.kind === "channel"
      ? { part: "contentDetails", id: source.channelId }
      : { part: "contentDetails", forHandle: source.handle };

  const response = await fetchYouTubeApi<
    YouTubeApiListResponse<YouTubeChannelItem>
  >("channels", params, rateLimiter);

  const channel = response.items?.[0];
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error("Unable to resolve uploads playlist for YouTube source.");
  }

  return uploadsPlaylistId;
}

/**
 * Lists video IDs from a YouTube playlist with pagination.
 *
 * @param playlistId - Playlist identifier
 * @param rateLimiter - Shared API rate limiter
 */
export async function listPlaylistVideoIds(
  playlistId: string,
  rateLimiter: RateLimiter,
): Promise<readonly string[]> {
  const videoIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "contentDetails,snippet",
      playlistId,
      maxResults: String(DEFAULT_PAGE_SIZE),
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = await fetchYouTubeApi<
      YouTubeApiListResponse<YouTubePlaylistItem>
    >("playlistItems", params, rateLimiter);

    for (const item of response.items ?? []) {
      const videoId =
        item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;

      if (videoId) {
        videoIds.push(videoId);
      }
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return [...new Set(videoIds)];
}

/**
 * Fetches public metadata for a batch of YouTube videos.
 *
 * @param videoIds - Video identifiers to fetch
 * @param rateLimiter - Shared API rate limiter
 * @param context - Optional channel or playlist context
 */
export async function fetchVideoMetadata(
  videoIds: readonly string[],
  rateLimiter: RateLimiter,
  context?: { channelId?: string; playlistId?: string },
): Promise<readonly YouTubeVideoMetadata[]> {
  const results: YouTubeVideoMetadata[] = [];

  for (let index = 0; index < videoIds.length; index += DEFAULT_PAGE_SIZE) {
    const batch = videoIds.slice(index, index + DEFAULT_PAGE_SIZE);

    const response = await fetchYouTubeApi<
      YouTubeApiListResponse<YouTubeVideoItem>
    >(
      "videos",
      {
        part: "snippet,contentDetails",
        id: batch.join(","),
      },
      rateLimiter,
    );

    for (const item of response.items ?? []) {
      const metadata = youtubeVideoMetadataSchema.parse({
        videoId: item.id,
        title: item.snippet?.title ?? "Untitled",
        description: item.snippet?.description ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        duration: item.contentDetails?.duration ?? "",
        url: buildYouTubeVideoUrl(item.id),
        channelId: context?.channelId ?? item.snippet?.channelId,
        playlistId: context?.playlistId,
      });

      results.push(metadata);
    }
  }

  return results;
}

/**
 * Discovers videos from configured YouTube channel and playlist sources.
 *
 * @param sources - Raw configured source strings
 */
export async function discoverYouTubeVideos(
  sources: readonly string[],
): Promise<readonly YouTubeVideoMetadata[]> {
  if (sources.length === 0) {
    return [];
  }

  const rateLimiter = createRateLimiter({ minIntervalMs: 300 });
  const videoMap = new Map<string, YouTubeVideoMetadata>();

  for (const sourceValue of sources) {
    const source = parseYouTubeSource(sourceValue);
    const playlistId = await resolveUploadsPlaylistId(source, rateLimiter);
    const videoIds = await listPlaylistVideoIds(playlistId, rateLimiter);

    logger.info("Discovered playlist videos", {
      source: sourceValue,
      playlistId,
      count: videoIds.length,
    });

    const metadata = await fetchVideoMetadata(
      videoIds,
      rateLimiter,
      source.kind === "playlist"
        ? { playlistId: source.playlistId }
        : source.kind === "channel"
          ? { channelId: source.channelId }
          : undefined,
    );

    for (const video of metadata) {
      videoMap.set(video.videoId, video);
    }
  }

  return [...videoMap.values()];
}
