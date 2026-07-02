/**
 * Supported source origins for raw document collection.
 */
export const SOURCE_TYPES = [
  "website",
  "youtube",
  "blog",
  "social",
  "other",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Knowledge topics aligned with persona content files.
 */
export const TOPICS = [
  "bio",
  "teaching-style",
  "vocabulary",
  "philosophy",
  "general",
] as const;

export type Topic = (typeof TOPICS)[number];

/**
 * Supported persona identifiers for the knowledge pipeline.
 */
export const PIPELINE_PERSONA_IDS = ["hitesh", "piyush"] as const;

export type PipelinePersonaId = (typeof PIPELINE_PERSONA_IDS)[number];

/**
 * A document collected from a public source before processing.
 */
export interface RawDocument {
  readonly id: string;
  readonly personaId: PipelinePersonaId;
  readonly sourceType: SourceType;
  readonly sourceUrl: string;
  readonly title: string;
  readonly content: string;
  readonly collectedAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * A normalized document after cleaning and structuring.
 */
export interface ProcessedDocument {
  readonly id: string;
  readonly personaId: PipelinePersonaId;
  readonly rawDocumentId: string;
  readonly sourceType: SourceType;
  readonly topic: Topic;
  readonly title: string;
  readonly content: string;
  readonly processedAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * A summarized knowledge artifact ready for prompt or RAG use.
 */
export interface KnowledgeDocument {
  readonly id: string;
  readonly personaId: PipelinePersonaId;
  readonly processedDocumentId: string;
  readonly topic: Topic;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Source attribution carried through the pipeline into chunks.
 */
export interface ChunkSourceAttribution {
  readonly sourceType: string;
  readonly sourceUrl: string;
  readonly rawDocumentId: string;
  readonly processedDocumentId: string;
  readonly knowledgeDocumentId: string;
  readonly title: string;
}

/**
 * A retrieval-ready text chunk derived from a knowledge document.
 */
export interface ChunkDocument {
  readonly id: string;
  readonly personaId: PipelinePersonaId;
  readonly knowledgeDocumentId: string;
  readonly topic: Topic;
  readonly section: string;
  readonly chunkIndex: number;
  readonly text: string;
  readonly hash: string;
  readonly keywords: readonly string[];
  readonly source: ChunkSourceAttribution;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * A vector-ready embedding record linked to knowledge content.
 */
export interface EmbeddingDocument {
  readonly id: string;
  readonly personaId: PipelinePersonaId;
  readonly knowledgeDocumentId: string;
  readonly topic: Topic;
  readonly chunkIndex: number;
  readonly text: string;
  readonly embedding: readonly number[];
  readonly model: string;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Contract for a single pipeline stage.
 */
export interface PipelineStage {
  /**
   * Executes the stage for the given persona.
   *
   * @param personaId - Target persona identifier
   */
  run(personaId: string): Promise<void>;
}

/**
 * CLI command identifiers.
 */
export const PIPELINE_COMMANDS = [
  "collect",
  "process",
  "summarize",
  "chunk",
  "embed",
  "build",
] as const;

export type PipelineCommand = (typeof PIPELINE_COMMANDS)[number];
