import { createHash } from "node:crypto";

import { QdrantClient } from "@qdrant/js-client-rest";

import { getEmbeddingEnv, logger } from "../shared/index.js";

/** Distance metric used for the knowledge collection. */
const DISTANCE_METRIC = "Cosine" as const;

/**
 * A single point ready for upsert into Qdrant.
 */
export interface QdrantPoint {
  readonly id: string;
  readonly vector: number[];
  readonly payload: Record<string, unknown>;
}

/**
 * Qdrant connection bundle resolved from the environment.
 */
export interface QdrantContext {
  readonly client: QdrantClient;
  readonly collection: string;
}

/**
 * Derives a deterministic UUID (v5-style, name-based) from an arbitrary string.
 *
 * Qdrant point IDs must be unsigned integers or UUIDs, so chunk IDs are hashed
 * into a stable UUID to support idempotent upserts and existence checks.
 *
 * @param value - Source string (e.g. a chunk ID)
 */
export function toPointId(value: string): string {
  const hex = createHash("sha1").update(value, "utf-8").digest("hex");
  const bytes = hex.slice(0, 32).split("");

  bytes[12] = "5";
  const variantNibble = (parseInt(hex[16], 16) & 0x3) | 0x8;
  bytes[16] = variantNibble.toString(16);

  const joined = bytes.join("");

  return [
    joined.slice(0, 8),
    joined.slice(8, 12),
    joined.slice(12, 16),
    joined.slice(16, 20),
    joined.slice(20, 32),
  ].join("-");
}

/**
 * Creates a Qdrant client and resolves the target collection name.
 */
export function createQdrantContext(): QdrantContext {
  const env = getEmbeddingEnv();

  const client = new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY,
    checkCompatibility: false,
  });

  return { client, collection: env.QDRANT_COLLECTION };
}

/**
 * Ensures the target collection exists, creating it when missing.
 *
 * @param context - Qdrant connection bundle
 * @param dimensions - Embedding vector dimensionality
 */
export async function ensureCollection(
  context: QdrantContext,
  dimensions: number,
): Promise<void> {
  const { client, collection } = context;

  const { exists } = await client.collectionExists(collection);

  if (exists) {
    return;
  }

  logger.info("Creating Qdrant collection", {
    collection,
    dimensions,
    distance: DISTANCE_METRIC,
  });

  await client.createCollection(collection, {
    vectors: {
      size: dimensions,
      distance: DISTANCE_METRIC,
    },
  });
}

/**
 * Returns the subset of point IDs that already exist in the collection.
 *
 * @param context - Qdrant connection bundle
 * @param ids - Candidate point IDs
 */
export async function getExistingPointIds(
  context: QdrantContext,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }

  const { client, collection } = context;

  const found = await client.retrieve(collection, {
    ids: [...ids],
    with_payload: false,
    with_vector: false,
  });

  return new Set(found.map((point) => String(point.id)));
}

/**
 * Upserts a batch of points into the collection.
 *
 * @param context - Qdrant connection bundle
 * @param points - Points to upsert
 */
export async function upsertPoints(
  context: QdrantContext,
  points: readonly QdrantPoint[],
): Promise<void> {
  if (points.length === 0) {
    return;
  }

  const { client, collection } = context;

  await client.upsert(collection, {
    wait: true,
    points: points.map((point) => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload,
    })),
  });
}
