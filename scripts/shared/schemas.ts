import { z } from "zod";

import {
  PIPELINE_PERSONA_IDS,
  SOURCE_TYPES,
  TOPICS,
} from "./types.js";

/**
 * Zod schema for {@link SourceType}.
 */
export const sourceTypeSchema = z.enum(SOURCE_TYPES);

/**
 * Zod schema for {@link Topic}.
 */
export const topicSchema = z.enum(TOPICS);

/**
 * Zod schema for pipeline persona identifiers.
 */
export const pipelinePersonaIdSchema = z.enum(PIPELINE_PERSONA_IDS);

/**
 * Zod schema for {@link RawDocument}.
 */
export const rawDocumentSchema = z.object({
  id: z.string().min(1),
  personaId: pipelinePersonaIdSchema,
  sourceType: sourceTypeSchema,
  sourceUrl: z.string(),
  title: z.string().min(1),
  content: z.string(),
  collectedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for {@link ProcessedDocument}.
 */
export const processedDocumentSchema = z.object({
  id: z.string().min(1),
  personaId: pipelinePersonaIdSchema,
  rawDocumentId: z.string().min(1),
  sourceType: sourceTypeSchema,
  topic: topicSchema,
  title: z.string().min(1),
  content: z.string(),
  processedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for {@link KnowledgeDocument}.
 */
export const knowledgeDocumentSchema = z.object({
  id: z.string().min(1),
  personaId: pipelinePersonaIdSchema,
  processedDocumentId: z.string().min(1),
  topic: topicSchema,
  title: z.string().min(1),
  summary: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for {@link EmbeddingDocument}.
 */
export const embeddingDocumentSchema = z.object({
  id: z.string().min(1),
  personaId: pipelinePersonaIdSchema,
  knowledgeDocumentId: z.string().min(1),
  topic: topicSchema,
  chunkIndex: z.number().int().nonnegative(),
  text: z.string().min(1),
  embedding: z.array(z.number()),
  model: z.string().min(1),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type RawDocumentInput = z.infer<typeof rawDocumentSchema>;
export type ProcessedDocumentInput = z.infer<typeof processedDocumentSchema>;
export type KnowledgeDocumentInput = z.infer<typeof knowledgeDocumentSchema>;
export type EmbeddingDocumentInput = z.infer<typeof embeddingDocumentSchema>;

/**
 * Metadata for a discovered YouTube video.
 */
export const youtubeVideoMetadataSchema = z.object({
  videoId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  publishedAt: z.string(),
  duration: z.string(),
  url: z.string().url(),
  channelId: z.string().optional(),
  playlistId: z.string().optional(),
});

export type YouTubeVideoMetadata = z.infer<typeof youtubeVideoMetadataSchema>;

/**
 * Index file listing collected YouTube videos for a persona.
 */
export const youtubeCollectionIndexSchema = z.object({
  personaId: pipelinePersonaIdSchema,
  source: z.literal("youtube"),
  updatedAt: z.string().datetime(),
  videos: z.array(
    z.object({
      videoId: z.string().min(1),
      title: z.string().min(1),
      url: z.string().url(),
      fileName: z.string().min(1),
      hasTranscript: z.boolean(),
      collectedAt: z.string().datetime(),
    }),
  ),
});

export type YouTubeCollectionIndex = z.infer<typeof youtubeCollectionIndexSchema>;
