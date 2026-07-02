/**
 * Parsed YouTube source reference from persona configuration.
 */
export type YouTubeSourceRef =
  | {
      readonly kind: "channel";
      readonly channelId: string;
    }
  | {
      readonly kind: "handle";
      readonly handle: string;
    }
  | {
      readonly kind: "playlist";
      readonly playlistId: string;
    };

/**
 * Options for the YouTube collector.
 */
export interface YouTubeCollectorOptions {
  /** When true, overwrites existing raw document files. */
  readonly force?: boolean;
}

/**
 * Result of collecting a single YouTube video.
 */
export interface YouTubeCollectionResult {
  readonly videoId: string;
  readonly fileName: string;
  readonly hasTranscript: boolean;
  readonly skipped: boolean;
}

/**
 * Outcome summary for a YouTube collection run.
 */
export interface YouTubeCollectorSummary {
  readonly discovered: number;
  readonly written: number;
  readonly skipped: number;
  readonly withoutTranscript: number;
  readonly failed: number;
}
