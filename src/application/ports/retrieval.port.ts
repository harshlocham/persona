import type { PersonaId } from "@/domain/models/persona";

/**
 * A retrieved persona knowledge snippet used to ground substance and voice.
 */
export interface RetrievedKnowledgeItem {
  readonly content: string;
  readonly source?: string;
  readonly score: number;
}

/**
 * A retrieved persona-owned learning resource (video/course/playlist/blog).
 */
export interface RetrievedResource {
  readonly title: string;
  readonly type: string;
  readonly url: string;
  readonly difficulty: string;
  readonly topics: readonly string[];
  readonly summary: string;
  readonly durationMinutes?: number;
  readonly score: number;
}

/**
 * How well retrieval covered the user's question. Drives the grounding
 * fallback policy in the prompt.
 */
export type RetrievalSufficiency = "strong" | "weak" | "none";

/**
 * Input for {@link RetrievalPort.retrieve}. Persona is set server-side and is
 * never derived from client-supplied context.
 */
export interface RetrievalRequest {
  readonly personaId: PersonaId;
  readonly query: string;
  readonly wantsResources: boolean;
  readonly resourceType?: string;
  readonly topicHints?: readonly string[];
}

/**
 * Result of a retrieval pass.
 */
export interface RetrievalResult {
  readonly knowledge: readonly RetrievedKnowledgeItem[];
  readonly resources: readonly RetrievedResource[];
  readonly sufficiency: RetrievalSufficiency;
}

/**
 * Port for persona-scoped knowledge and resource retrieval.
 * Implemented by infrastructure; consumed by application use cases.
 */
export interface RetrievalPort {
  /**
   * Retrieves persona knowledge and (optionally) resources for a query.
   * Implementations MUST hard-filter by persona and degrade gracefully to an
   * empty result rather than throwing.
   */
  retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
}
