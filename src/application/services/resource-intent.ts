/**
 * Lightweight, dependency-free intent detection for the retrieval slice.
 *
 * This is a heuristic stand-in for a full LLM-based intent classifier: it only
 * decides whether the user is asking for learning resources, what type, and
 * which topics to bias retrieval toward. Substance retrieval still runs for
 * every request regardless of the outcome here.
 */
export interface ResourceIntent {
  readonly wantsResources: boolean;
  readonly resourceType?: string;
  readonly topicHints: readonly string[];
}

const RESOURCE_TRIGGERS = [
  "recommend",
  "suggest",
  "which video",
  "what video",
  "watch",
  "video",
  "videos",
  "playlist",
  "course",
  "courses",
  "tutorial",
  "blog",
  "resource",
  "resources",
  "roadmap",
  "where should i learn",
  "how can i learn",
  "how do i learn",
  "how should i learn",
];

const TYPE_KEYWORDS: Record<string, readonly string[]> = {
  video: ["video", "videos", "watch"],
  playlist: ["playlist", "playlists"],
  course: ["course", "courses", "series"],
  blog: ["blog", "blogs", "article", "post"],
};

const TOPIC_KEYWORDS: Record<string, readonly string[]> = {
  backend: ["backend", "back end", "server", "api"],
  frontend: ["frontend", "front end", "css", "html"],
  react: ["react", "next.js", "nextjs"],
  javascript: ["javascript", "typescript", "node", "nodejs"],
  database: ["database", "mongodb", "sql", "postgres", "redis"],
  "system-design": ["system design", "microservice", "monolith", "scalab"],
  devops: ["docker", "kubernetes", "deploy", "devops"],
  dsa: ["dsa", "algorithm", "data structure", "leetcode"],
  ai: ["ai", "agent", "llm", "rag"],
  career: ["career", "interview", "job", "resume"],
  python: ["python", "django"],
  java: ["java", "spring"],
};

function firstMatch(
  haystack: string,
  map: Record<string, readonly string[]>,
): string | undefined {
  for (const [key, keywords] of Object.entries(map)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return key;
    }
  }
  return undefined;
}

function allMatches(
  haystack: string,
  map: Record<string, readonly string[]>,
): string[] {
  return Object.entries(map)
    .filter(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword)))
    .map(([key]) => key);
}

/**
 * Detects resource intent, type, and topic hints from a user message.
 *
 * @param message - Latest user message text
 */
export function detectResourceIntent(message: string): ResourceIntent {
  const haystack = ` ${message.toLowerCase()} `;

  const wantsResources = RESOURCE_TRIGGERS.some((trigger) =>
    haystack.includes(trigger),
  );

  return {
    wantsResources,
    resourceType: wantsResources ? firstMatch(haystack, TYPE_KEYWORDS) : undefined,
    topicHints: allMatches(haystack, TOPIC_KEYWORDS),
  };
}
