import type { PipelinePersonaId, Topic } from "../shared/types.js";

/**
 * Structured knowledge sections extracted from a processed document.
 */
export interface KnowledgeSections {
  readonly mainConcepts: readonly string[];
  readonly practicalAdvice: readonly string[];
  readonly teachingPattern: readonly string[];
  readonly importantVocabulary: readonly string[];
  readonly examples: readonly string[];
  readonly commonMistakes: readonly string[];
  readonly keyTakeaways: readonly string[];
}

/**
 * Source attribution preserved in knowledge artifacts.
 */
export interface KnowledgeSourceAttribution {
  readonly sourceType: string;
  readonly sourceUrl: string;
  readonly rawDocumentId: string;
  readonly processedDocumentId: string;
  readonly title: string;
}

/**
 * Metadata bundled with a knowledge document.
 */
export interface KnowledgeDocumentMetadata {
  readonly source: KnowledgeSourceAttribution;
  readonly topic: Topic;
  readonly topics: readonly Topic[];
  readonly keywords: readonly string[];
  readonly language: string;
  readonly createdAt: string;
  readonly sections: KnowledgeSections;
}

/**
 * Fully built knowledge artifact before persistence.
 */
export interface BuiltKnowledgeDocument {
  readonly id: string;
  readonly personaId: PipelinePersonaId;
  readonly processedDocumentId: string;
  readonly topic: Topic;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly markdown: string;
  readonly metadata: KnowledgeDocumentMetadata;
}
