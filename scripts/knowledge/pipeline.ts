import fs from "node:fs/promises";
import path from "node:path";

import { getPersonaConfig } from "../config/personas.js";
import {
  ensurePersonaStorageDirs,
  getProcessedDir,
  logger,
  type PipelinePersonaId,
} from "../shared/index.js";
import { writeKnowledgeFromProcessedFile } from "./writer.js";

/**
 * Options for the knowledge generation pipeline.
 */
export interface KnowledgePipelineOptions {
  /** When true, overwrites existing knowledge files. */
  readonly force?: boolean;
}

/**
 * Summary of a knowledge generation run.
 */
export interface KnowledgePipelineSummary {
  readonly discovered: number;
  readonly written: number;
  readonly skipped: number;
  readonly failed: number;
}

interface ProcessedDocumentRef {
  readonly relativePath: string;
  readonly absolutePath: string;
}

/**
 * Recursively discovers processed JSON documents for a persona.
 *
 * @param personaId - Target persona identifier
 */
export async function discoverProcessedDocuments(
  personaId: PipelinePersonaId,
): Promise<readonly ProcessedDocumentRef[]> {
  const rootDir = getProcessedDir(personaId);
  const results: ProcessedDocumentRef[] = [];

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
 * Runs knowledge generation for a persona.
 *
 * @param personaId - Target persona identifier
 * @param options - Pipeline options
 */
export async function runKnowledgePipeline(
  personaId: string,
  options: KnowledgePipelineOptions = {},
): Promise<KnowledgePipelineSummary> {
  const config = getPersonaConfig(personaId);
  const force = options.force ?? false;

  await ensurePersonaStorageDirs(config.id);

  const processedDocuments = await discoverProcessedDocuments(config.id);

  const summary = {
    discovered: processedDocuments.length,
    written: 0,
    skipped: 0,
    failed: 0,
  } satisfies KnowledgePipelineSummary;

  logger.info("Discovered processed documents for knowledge generation", {
    personaId: config.id,
    count: processedDocuments.length,
  });

  for (const [index, processedRef] of processedDocuments.entries()) {
    logger.info("Generating knowledge document", {
      personaId: config.id,
      progress: `${index + 1}/${processedDocuments.length}`,
      processedPath: processedRef.relativePath,
    });

    try {
      const result = await writeKnowledgeFromProcessedFile(
        processedRef.absolutePath,
        force,
      );

      if (result === "skipped") {
        summary.skipped += 1;
        continue;
      }

      summary.written += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("Failed to generate knowledge document", {
        processedPath: processedRef.relativePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}
