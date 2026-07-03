import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import { QdrantClient } from "@qdrant/js-client-rest";

import type {
  RetrievalPort,
  RetrievalRequest,
  RetrievalResult,
  RetrievalSufficiency,
  RetrievedKnowledgeItem,
  RetrievedResource,
} from "@/application/ports/retrieval.port";
import { getServerEnv, type ServerEnv } from "@/infrastructure/config/env";

const KNOWLEDGE_TOP_K = 6;
const RESOURCE_TOP_K = 5;

/** Cosine score above which a hit is considered strongly relevant. */
const STRONG_SCORE_THRESHOLD = 0.72;

interface QdrantSearchHit {
  readonly score: number;
  readonly payload?: Record<string, unknown> | null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Qdrant-backed {@link RetrievalPort}. Embeds the query with the retrieval-query
 * task type, then searches the persona-scoped knowledge and resource
 * collections. Any failure degrades to an empty result so chat never breaks.
 */
export class QdrantRetrievalService implements RetrievalPort {
  private client: QdrantClient | undefined;

  constructor(private readonly getEnv: () => ServerEnv = getServerEnv) {}

  private getClient(env: ServerEnv): QdrantClient {
    if (!this.client) {
      this.client = new QdrantClient({
        url: env.QDRANT_URL,
        apiKey: env.QDRANT_API_KEY,
        checkCompatibility: false,
      });
    }
    return this.client;
  }

  private async embedQuery(env: ServerEnv, query: string): Promise<number[]> {
    const provider = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY.trim(),
    });

    const { embedding } = await embed({
      model: provider.textEmbeddingModel(env.EMBEDDING_MODEL),
      value: query,
      providerOptions: {
        google: {
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: env.EMBEDDING_DIMENSIONS,
        },
      },
    });

    return embedding;
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const empty: RetrievalResult = {
      knowledge: [],
      resources: [],
      sufficiency: "none",
    };

    const query = request.query.trim();
    if (query.length === 0) {
      return empty;
    }

    try {
      const env = this.getEnv();
      const client = this.getClient(env);
      const vector = await this.embedQuery(env, query);

      const personaFilter = {
        must: [{ key: "persona", match: { value: request.personaId } }],
      };

      const [knowledgeHits, resourceHits] = await Promise.all([
        client
          .search(env.QDRANT_COLLECTION, {
            vector,
            limit: KNOWLEDGE_TOP_K,
            filter: personaFilter,
            with_payload: true,
          })
          .catch(() => [] as QdrantSearchHit[]),
        this.searchResources(client, env, vector, request),
      ]);

      const knowledge = this.mapKnowledge(knowledgeHits);
      const resources = this.mapResources(resourceHits);

      return {
        knowledge,
        resources,
        sufficiency: this.scoreSufficiency(knowledge, resources),
      };
    } catch {
      return empty;
    }
  }

  /**
   * Runs a single persona-scoped resource search, optionally narrowed to one
   * resource type. Degrades to an empty list on failure so chat never breaks.
   */
  private searchResource(
    client: QdrantClient,
    env: ServerEnv,
    vector: number[],
    personaId: string,
    limit: number,
    type?: string,
  ): Promise<QdrantSearchHit[]> {
    const must: Record<string, unknown>[] = [
      { key: "persona", match: { value: personaId } },
    ];

    if (type) {
      must.push({ key: "type", match: { value: type } });
    }

    return client
      .search(env.RESOURCES_COLLECTION, {
        vector,
        limit,
        filter: { must },
        with_payload: true,
      })
      .catch(() => [] as QdrantSearchHit[]);
  }

  /**
   * Retrieves persona-owned resources. When the user asked for a specific type
   * (e.g. "course", "video"), that type is honored directly. Otherwise a blend
   * of courses and videos is guaranteed so the persona can offer both a paid
   * course and a free video when both are relevant, instead of whichever type
   * happens to rank highest.
   */
  private async searchResources(
    client: QdrantClient,
    env: ServerEnv,
    vector: number[],
    request: RetrievalRequest,
  ): Promise<QdrantSearchHit[]> {
    if (!request.wantsResources) {
      return [];
    }

    const personaId = request.personaId;

    if (request.resourceType) {
      return this.searchResource(
        client,
        env,
        vector,
        personaId,
        RESOURCE_TOP_K,
        request.resourceType,
      );
    }

    const [general, courses, videos] = await Promise.all([
      this.searchResource(client, env, vector, personaId, RESOURCE_TOP_K),
      this.searchResource(client, env, vector, personaId, 2, "course"),
      this.searchResource(client, env, vector, personaId, 2, "video"),
    ]);

    return this.mergeResourceHits(general, courses, videos);
  }

  /**
   * Merges type-specific and general resource hits into a single ranked list,
   * reserving slots for courses and videos first (so both types survive) and
   * filling the remainder by relevance. De-duplicates by URL.
   */
  private mergeResourceHits(
    general: readonly QdrantSearchHit[],
    courses: readonly QdrantSearchHit[],
    videos: readonly QdrantSearchHit[],
  ): QdrantSearchHit[] {
    const seen = new Set<string>();
    const picked: QdrantSearchHit[] = [];

    const take = (hits: readonly QdrantSearchHit[], max: number): void => {
      let added = 0;

      for (const hit of hits) {
        if (added >= max) {
          break;
        }

        const url = asString(hit.payload?.url);
        if (!url || seen.has(url)) {
          continue;
        }

        seen.add(url);
        picked.push(hit);
        added += 1;
      }
    };

    take(courses, 2);
    take(videos, 2);
    take(general, RESOURCE_TOP_K);

    return picked
      .slice(0, RESOURCE_TOP_K)
      .sort((left, right) => right.score - left.score);
  }

  private mapKnowledge(
    hits: readonly QdrantSearchHit[],
  ): RetrievedKnowledgeItem[] {
    const items: RetrievedKnowledgeItem[] = [];

    for (const hit of hits) {
      const payload = hit.payload ?? {};
      const content = asString(payload.text);
      if (!content) {
        continue;
      }

      const source = payload.source as Record<string, unknown> | undefined;
      const label = source
        ? asString(source.title) ?? asString(source.sourceUrl)
        : undefined;

      items.push({ content, source: label, score: hit.score });
    }

    return items;
  }

  private mapResources(hits: readonly QdrantSearchHit[]): RetrievedResource[] {
    const items: RetrievedResource[] = [];

    for (const hit of hits) {
      const payload = hit.payload ?? {};
      const title = asString(payload.title);
      const url = asString(payload.url);
      if (!title || !url) {
        continue;
      }

      const duration =
        typeof payload.durationMinutes === "number"
          ? payload.durationMinutes
          : undefined;

      items.push({
        title,
        type: asString(payload.type) ?? "video",
        url,
        difficulty: asString(payload.difficulty) ?? "intermediate",
        topics: asStringArray(payload.topics),
        summary: asString(payload.summary) ?? "",
        durationMinutes: duration,
        score: hit.score,
      });
    }

    return items;
  }

  private scoreSufficiency(
    knowledge: readonly RetrievedKnowledgeItem[],
    resources: readonly RetrievedResource[],
  ): RetrievalSufficiency {
    const scores = [
      ...knowledge.map((item) => item.score),
      ...resources.map((item) => item.score),
    ];

    if (scores.length === 0) {
      return "none";
    }

    const topScore = Math.max(...scores);

    if (topScore >= STRONG_SCORE_THRESHOLD && scores.length >= 2) {
      return "strong";
    }

    return "weak";
  }
}

/**
 * Default singleton for server-side usage.
 */
export const qdrantRetrievalService = new QdrantRetrievalService();
