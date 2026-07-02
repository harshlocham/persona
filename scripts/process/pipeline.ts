import fs from "node:fs/promises";
import path from "node:path";

import type { PersonaPipelineConfig } from "../config/personas.js";
import { getPersonaConfig } from "../config/personas.js";
import {
  ensureDir,
  fileExists,
  getProcessedDir,
  getRawDir,
  logger,
  processedDocumentSchema,
  rawDocumentSchema,
  readJsonFile,
  writeJsonFile,
  type PipelinePersonaId,
  type RawDocumentInput,
} from "../shared/index.js";
import { classifyContent, getPrimaryTopic } from "./classifier.js";
import { cleanContent } from "./cleaner.js";
import { normalizeContent } from "./normalize.js";

/**
 * Options for the processing pipeline.
 */
export interface ProcessPipelineOptions {
  /** When true, overwrites existing processed documents. */
  readonly force?: boolean;
}

/**
 * Summary of a processing run.
 */
export interface ProcessPipelineSummary {
  readonly discovered: number;
  readonly processed: number;
  readonly skipped: number;
  readonly failed: number;
}

interface RawDocumentRef {
  readonly relativePath: string;
  readonly absolutePath: string;
}

/**
 * Recursively discovers raw JSON documents for a persona.
 *
 * @param personaId - Target persona identifier
 */
export async function discoverRawDocuments(
  personaId: PipelinePersonaId,
): Promise<readonly RawDocumentRef[]> {
  const rootDir = getRawDir(personaId);
  const results: RawDocumentRef[] = [];

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
 * Returns the processed output path for a raw document.
 *
 * @param personaId - Target persona identifier
 * @param relativePath - Relative raw document path
 */
export function getProcessedDocumentPath(
  personaId: PipelinePersonaId,
  relativePath: string,
): string {
  return path.join(getProcessedDir(personaId), relativePath);
}

/**
 * Transforms a raw document into a processed document payload.
 *
 * @param raw - Validated raw document
 */
export function transformRawDocument(raw: RawDocumentInput) {
  const cleaned = cleanContent(raw.content);
  const normalized = normalizeContent(cleaned.content);
  const classification = classifyContent(normalized, raw.title);

  return processedDocumentSchema.parse({
    id: `processed-${raw.id}`,
    personaId: raw.personaId,
    rawDocumentId: raw.id,
    sourceType: raw.sourceType,
    topic: getPrimaryTopic(classification.topics),
    title: raw.title.trim(),
    content: normalized,
    processedAt: new Date().toISOString(),
    metadata: {
      ...raw.metadata,
      topics: classification.topics,
      summary: classification.summary,
      keywords: classification.keywords,
      language: classification.language,
      cleaning: cleaned.stats,
      sourceUrl: raw.sourceUrl,
      rawCollectedAt: raw.collectedAt,
    },
  });
}

/**
 * Processes a single raw document file.
 *
 * @param rawRef - Raw document file reference
 * @param config - Persona configuration
 * @param force - Whether to overwrite existing output
 */
export async function processRawDocumentFile(
  rawRef: RawDocumentRef,
  config: PersonaPipelineConfig,
  force: boolean,
): Promise<"processed" | "skipped"> {
  const outputPath = getProcessedDocumentPath(config.id, rawRef.relativePath);

  if (!force && (await fileExists(outputPath))) {
    return "skipped";
  }

  const raw = rawDocumentSchema.parse(await readJsonFile(rawRef.absolutePath));
  const processed = transformRawDocument(raw);

  await ensureDir(path.dirname(outputPath));
  await writeJsonFile(outputPath, processed);

  return "processed";
}

/**
 * Runs the full processing pipeline for a persona.
 *
 * @param personaId - Target persona identifier
 * @param options - Pipeline options
 */
export async function runProcessPipeline(
  personaId: string,
  options: ProcessPipelineOptions = {},
): Promise<ProcessPipelineSummary> {
  const config = getPersonaConfig(personaId);
  const force = options.force ?? false;
  const rawDocuments = await discoverRawDocuments(config.id);

  const summary = {
    discovered: rawDocuments.length,
    processed: 0,
    skipped: 0,
    failed: 0,
  } satisfies ProcessPipelineSummary;

  logger.info("Discovered raw documents", {
    personaId: config.id,
    count: rawDocuments.length,
  });

  for (const [index, rawRef] of rawDocuments.entries()) {
    logger.info("Processing document", {
      personaId: config.id,
      progress: `${index + 1}/${rawDocuments.length}`,
      rawPath: rawRef.relativePath,
    });

    try {
      const result = await processRawDocumentFile(rawRef, config, force);

      if (result === "skipped") {
        summary.skipped += 1;
        logger.info("Skipped existing processed document", {
          rawPath: rawRef.relativePath,
          outputPath: getProcessedDocumentPath(config.id, rawRef.relativePath),
        });
        continue;
      }

      summary.processed += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("Failed to process document", {
        rawPath: rawRef.relativePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}
