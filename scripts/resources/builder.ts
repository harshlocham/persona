import {
  resourceRecordSchema,
  type RawDocumentInput,
  type ResourceRecordInput,
} from "../shared/index.js";

/**
 * Subject-topic patterns used to tag resources for filterable retrieval. These
 * are learning topics (backend, react, …), distinct from the persona content
 * topics (bio/teaching-style/…) used elsewhere in the pipeline.
 *
 * Patterns are word-boundary anchored on purpose: naive substring matching
 * produced false positives (e.g. "chai" → ai, "interact" → react, "js" inside
 * "json"), which over-tagged the catalog. `\b` boundaries only match whole
 * words while `\w*` suffixes still allow prefix families (scalab → scalable).
 */
const RESOURCE_TOPIC_PATTERNS: Record<string, RegExp> = {
  backend: /\b(back[ -]?end|server[ -]?side|rest\s?api|graphql|express)\b/i,
  frontend: /\b(front[ -]?end|css|html|tailwind|ui\/ux)\b/i,
  react: /\b(react(?:js)?|next\.?js|jsx)\b/i,
  javascript: /\b(javascript|typescript|node(?:\.?js)?)\b/i,
  database: /\b(database|mongo(?:db)?|sql|postgres(?:ql)?|mysql|firestore|redis|prisma)\b/i,
  "system-design":
    /\b(system design|scalab\w*|micro[ -]?service\w*|monolith\w*|distributed|load[ -]?balanc\w*|caching)\b/i,
  devops: /\b(docker|kubernetes|k8s|ci\/cd|devops|deploy\w*|nginx|traefik)\b/i,
  dsa: /\b(dsa|algorithm\w*|data structure\w*|leetcode|recursion|binary (?:tree|search))\b/i,
  ai: /\b(a\.?i|gen(?:erative)? ?ai|agent(?:ic|s)?|llms?|machine learning|rag|openai)\b/i,
  career: /\b(career|interview\w*|jobs?|resume|fresher\w*|salary|freelanc\w*)\b/i,
  python: /\b(python|django|flask|fastapi)\b/i,
  java: /\b(java|spring boot|jvm|kotlin)\b/i,
};

const BEGINNER_HINTS = [
  "beginner",
  "introduction",
  "intro ",
  "basics",
  "fundamental",
  "getting started",
  "from scratch",
  "for beginners",
  "tutorial for",
  "what is",
  "step by step",
  "learn ",
  "101",
  "crash course",
  "for dummies",
];

const ADVANCED_HINTS = [
  "advanced",
  "system design",
  "scalab",
  "production",
  "deep dive",
  "deep-dive",
  "in depth",
  "in-depth",
  "internals",
  "under the hood",
  "microservice",
  "mastering",
  "expert",
  "at scale",
  "optimization",
  "optimizing",
];

/**
 * Parses an ISO-8601 duration (e.g. `PT30M12S`) into whole minutes.
 *
 * @param iso - ISO-8601 duration string
 */
export function parseIsoDurationMinutes(iso: string): number | undefined {
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso.trim());

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 60 + minutes + Math.round(seconds / 60);

  return Number.isFinite(total) ? total : undefined;
}

/**
 * Matches topics against a haystack of text using word-boundary patterns.
 */
function matchTopics(haystack: string): string[] {
  return Object.entries(RESOURCE_TOPIC_PATTERNS)
    .filter(([, pattern]) => pattern.test(haystack))
    .map(([topic]) => topic);
}

/**
 * Derives subject topics for a resource. Uses the title first (video-specific
 * and precise); falls back to the description only when the title yields
 * nothing, since YouTube descriptions carry boilerplate links to every series
 * and would otherwise over-tag every resource.
 *
 * @param title - Lowercased title
 * @param description - Lowercased description
 */
function deriveTopics(title: string, description: string): string[] {
  const fromTitle = matchTopics(title);
  if (fromTitle.length > 0) {
    return fromTitle;
  }

  const fromDescription = matchTopics(description);
  return fromDescription.length > 0 ? fromDescription : ["general"];
}

/**
 * Assigns a difficulty using title/description keyword hints.
 *
 * @param haystack - Lowercased title + description
 */
function deriveDifficulty(
  haystack: string,
): ResourceRecordInput["difficulty"] {
  if (ADVANCED_HINTS.some((hint) => haystack.includes(hint))) {
    return "advanced";
  }

  if (BEGINNER_HINTS.some((hint) => haystack.includes(hint))) {
    return "beginner";
  }

  return "intermediate";
}

const SUMMARY_SKIP_PREFIXES = [
  "visit ",
  "welcome to",
  "all source code",
  "join me",
  "for community",
  "instagram",
  "follow ",
  "subscribe",
  "check out",
  "checkout",
  "download",
  "sign up",
  "use code",
  "coupon",
  "discount",
  "github",
  "discord",
  "telegram",
  "twitter",
  "linkedin",
  "code:",
  "timestamps",
  "chapters",
  "0:00",
  "00:00",
];

/** Minimum characters for a description line to be a usable summary. */
const MIN_SUMMARY_LENGTH = 25;

/**
 * Builds a short, link-free summary from a video description, skipping the
 * common channel boilerplate lines, promo/link lines, and short headers. Falls
 * back to the title when the description carries no usable prose.
 *
 * @param description - Raw video description
 * @param fallback - Title used when the description has no usable prose
 */
function deriveSummary(description: string, fallback: string): string {
  const firstProse = description
    .split("\n")
    .map((line) => line.trim())
    .find((line) => {
      if (line.length < MIN_SUMMARY_LENGTH || /https?:\/\/|@|#\w/i.test(line)) {
        return false;
      }
      const lower = line.toLowerCase();
      return !SUMMARY_SKIP_PREFIXES.some((prefix) => lower.startsWith(prefix));
    });

  const candidate = (firstProse ?? fallback).replace(/\s+/g, " ").trim();

  return candidate.length > 240 ? `${candidate.slice(0, 237).trimEnd()}...` : candidate;
}

/**
 * Infers a resource type from its URL. Collected `watch?v=` items are videos;
 * playlist URLs (carrying `list=` without a specific video) are playlists.
 *
 * @param url - Resource URL
 */
function deriveType(url: string): ResourceRecordInput["type"] {
  const lower = url.toLowerCase();

  if (lower.includes("list=") && !lower.includes("watch?v=")) {
    return "playlist";
  }

  return "video";
}

/**
 * Converts a collected YouTube raw document into a resource record.
 *
 * @param raw - Validated raw document (must be a YouTube source)
 */
export function buildResourceRecord(
  raw: RawDocumentInput,
): ResourceRecordInput | undefined {
  const metadata = (raw.metadata ?? {}) as Record<string, unknown>;
  const videoId =
    typeof metadata.videoId === "string" ? metadata.videoId : undefined;

  if (!videoId) {
    return undefined;
  }

  const description =
    typeof metadata.description === "string" ? metadata.description : "";
  const durationIso =
    typeof metadata.duration === "string" ? metadata.duration : "";
  const publishedAt =
    typeof metadata.publishedAt === "string" ? metadata.publishedAt : undefined;

  const titleLower = raw.title.toLowerCase();
  const descriptionLower = description.toLowerCase();
  const difficultyHaystack = `${titleLower}\n${descriptionLower}`;

  return resourceRecordSchema.parse({
    id: `resource-${raw.personaId}-${videoId}`,
    personaId: raw.personaId,
    title: raw.title,
    type: deriveType(raw.sourceUrl),
    url: raw.sourceUrl,
    topics: deriveTopics(titleLower, descriptionLower),
    difficulty: deriveDifficulty(difficultyHaystack),
    durationMinutes: durationIso ? parseIsoDurationMinutes(durationIso) : undefined,
    publishedAt,
    summary: deriveSummary(description, raw.title),
    recommendedPrerequisites: [],
    recommendedNext: [],
    sourceType: raw.sourceType,
    createdAt: new Date().toISOString(),
  });
}
