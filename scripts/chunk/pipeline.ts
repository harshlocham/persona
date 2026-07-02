import fs from "node:fs/promises";
import path from "node:path";

import { getPersonaConfig } from "../config/personas.js";
import {
  ensurePersonaStorageDirs,
  getKnowledgeDir,
  logger,
  type PipelinePersonaId,
} from "../shared/index.js";
import { writeChunksFromKnowledgeFile } from "./writer.js";

/**
 * Options for the chunk generation pipeline.
 */
export interface ChunkPipelineOptions {
  /** When true, overwrites existing chunk files. */
  readonly force?: boolean;
}

/**
 * Summary of a chunk generation run.
 */
export interface ChunkPipelineSummary {
  readonly discovered: number;
  readonly written: number;
  readonly skipped: number;
  readonly failed: number;
  readonly chunks: number;
}

interface KnowledgeDocumentRef {
  readonly relativePath: string;
  readonly absolutePath: string;
}

/**
 * Recursively discovers knowledge JSON documents for a persona.
 *
 * @param personaId - Target persona identifier
 */
export async function discoverKnowledgeDocuments(
  personaId: PipelinePersonaId,
): Promise<readonly KnowledgeDocumentRef[]> {
  const rootDir = getKnowledgeDir(personaId);
  const results: KnowledgeDocumentRef[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries;

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      if (entry.name === "index.json") {
        continue;
      }

      results.push({
        relativePath: path.relative(rootDir, absolutePath),
        absolutePath,
      });
    }
  }

  await walk(rootDir);

  return results.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

/**
 * Runs chunk generation for a persona.
 *
 * @param personaId - Target persona identifier
 * @param options - Pipeline options
 */
export async function runChunkPipeline(
  personaId: string,
  options: ChunkPipelineOptions = {},
): Promise<ChunkPipelineSummary> {
  const config = getPersonaConfig(personaId);
  const force = options.force ?? false;

  await ensurePersonaStorageDirs(config.id);

  const knowledgeDocuments = await discoverKnowledgeDocuments(config.id);

  const summary = {
    discovered: knowledgeDocuments.length,
    written: 0,
    skipped: 0,
    failed: 0,
    chunks: 0,
  } satisfies ChunkPipelineSummary;

  logger.info("Discovered knowledge documents for chunk generation", {
    personaId: config.id,
    count: knowledgeDocuments.length,
  });

  for (const [index, knowledgeRef] of knowledgeDocuments.entries()) {
    logger.info("Generating chunks", {
      personaId: config.id,
      progress: `${index + 1}/${knowledgeDocuments.length}`,
      knowledgePath: knowledgeRef.relativePath,
    });

    try {
      const result = await writeChunksFromKnowledgeFile(
        knowledgeRef.absolutePath,
        force,
      );

      if (result.status === "skipped") {
        summary.skipped += 1;
        continue;
      }

      summary.written += 1;
      summary.chunks += result.chunks;
    } catch (error) {
      summary.failed += 1;
      logger.error("Failed to generate chunks", {
        knowledgePath: knowledgeRef.relativePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}
