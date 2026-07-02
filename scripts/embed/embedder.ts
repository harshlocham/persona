import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";

import { getEmbeddingEnv, logger, sleep, withRetry } from "../shared/index.js";

/**
 * A configured, reusable text embedder backed by a single model.
 */
export interface Embedder {
  /** Model identifier used for every embedding request. */
  readonly model: string;
  /** Expected embedding vector dimensionality. */
  readonly dimensions: number;
  /** Preferred number of texts per batch. */
  readonly batchSize: number;
  /**
   * Embeds a batch of texts, preserving input order.
   *
   * @param texts - Texts to embed
   */
  embedBatch(texts: readonly string[]): Promise<number[][]>;
}

/**
 * Creates an embedder using the Google Generative AI provider.
 *
 * A single model is resolved once from the environment and reused for all
 * requests to keep vectors consistent across the collection. Requests are
 * paced so that per-item throughput stays under the configured
 * requests-per-minute limit, since each embedded item counts against the
 * provider's embed-content quota.
 */
export function createEmbedder(): Embedder {
  const env = getEmbeddingEnv();
  const provider = createGoogleGenerativeAI({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  const model = provider.textEmbeddingModel(env.EMBEDDING_MODEL);

  const perItemMs = 60_000 / env.EMBEDDING_REQUESTS_PER_MINUTE;
  let nextAvailableAt = 0;

  return {
    model: env.EMBEDDING_MODEL,
    dimensions: env.EMBEDDING_DIMENSIONS,
    batchSize: env.EMBEDDING_BATCH_SIZE,
    async embedBatch(texts: readonly string[]): Promise<number[][]> {
      if (texts.length === 0) {
        return [];
      }

      const now = Date.now();
      const waitMs = Math.max(0, nextAvailableAt - now);

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      nextAvailableAt = Date.now() + texts.length * perItemMs;

      const { embeddings } = await withRetry(
        () =>
          embedMany({
            model,
            values: [...texts],
            providerOptions: {
              google: {
                taskType: "RETRIEVAL_DOCUMENT",
                outputDimensionality: env.EMBEDDING_DIMENSIONS,
              },
            },
          }),
        {
          retries: 5,
          baseDelayMs: 2_000,
          maxDelayMs: 60_000,
          onRetry: (error, attempt, delayMs) => {
            logger.warn("Retrying embedding batch after error", {
              attempt,
              delayMs,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        },
      );

      if (embeddings.length !== texts.length) {
        logger.warn("Embedding count mismatch", {
          requested: texts.length,
          received: embeddings.length,
        });
      }

      return embeddings;
    },
  };
}
