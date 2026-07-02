import { z } from "zod";

/**
 * Environment variables used by pipeline scripts.
 */
const pipelineEnvSchema = z.object({
  YOUTUBE_API_KEY: z.string().min(1, "YOUTUBE_API_KEY is required for YouTube collection"),
});

export type PipelineEnv = z.infer<typeof pipelineEnvSchema>;

/**
 * Returns validated pipeline environment variables.
 *
 * @throws {Error} When required variables are missing
 */
export function getPipelineEnv(): PipelineEnv {
  const result = pipelineEnvSchema.safeParse(process.env);

  if (!result.success) {
    const message = result.error.flatten().fieldErrors;
    const formatted = Object.entries(message)
      .map(([key, errors]) => `${key}: ${errors?.join(", ")}`)
      .join("; ");

    throw new Error(`Invalid pipeline environment: ${formatted}`);
  }

  return result.data;
}

/**
 * Returns the YouTube Data API key when configured.
 *
 * @throws {Error} When YOUTUBE_API_KEY is missing
 */
export function getYoutubeApiKey(): string {
  return getPipelineEnv().YOUTUBE_API_KEY;
}

/**
 * Environment variables used by the embedding stage.
 */
const embeddingEnvSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .min(1, "GOOGLE_GENERATIVE_AI_API_KEY is required for embeddings"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(64),
  EMBEDDING_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(90),
  QDRANT_URL: z.string().default("http://localhost:6333"),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().default("persona_knowledge"),
});

export type EmbeddingEnv = z.infer<typeof embeddingEnvSchema>;

/**
 * Returns validated environment variables for the embedding stage.
 *
 * @throws {Error} When required variables are missing or invalid
 */
export function getEmbeddingEnv(): EmbeddingEnv {
  const result = embeddingEnvSchema.safeParse(process.env);

  if (!result.success) {
    const message = result.error.flatten().fieldErrors;
    const formatted = Object.entries(message)
      .map(([key, errors]) => `${key}: ${errors?.join(", ")}`)
      .join("; ");

    throw new Error(`Invalid embedding environment: ${formatted}`);
  }

  return result.data;
}
