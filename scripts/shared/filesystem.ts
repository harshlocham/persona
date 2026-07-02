import fs from "node:fs/promises";
import path from "node:path";

import type { PipelinePersonaId } from "./types.js";

const PROJECT_ROOT = process.cwd();
const STORAGE_ROOT = path.join(PROJECT_ROOT, "storage");

const STORAGE_STAGES = [
  "raw",
  "processed",
  "knowledge",
  "chunks",
  "embeddings",
] as const;

export type StorageStage = (typeof STORAGE_STAGES)[number];

/**
 * Returns the absolute project root directory.
 */
export function getProjectRoot(): string {
  return PROJECT_ROOT;
}

/**
 * Returns the absolute storage root directory.
 */
export function getStorageRoot(): string {
  return STORAGE_ROOT;
}

/**
 * Returns the directory path for a persona at a given pipeline stage.
 *
 * @param stage - Pipeline storage stage
 * @param personaId - Target persona identifier
 */
export function getPersonaStageDir(
  stage: StorageStage,
  personaId: PipelinePersonaId,
): string {
  return path.join(STORAGE_ROOT, stage, personaId);
}

/**
 * Returns the raw storage directory for a persona.
 */
export function getRawDir(personaId: PipelinePersonaId): string {
  return getPersonaStageDir("raw", personaId);
}

/**
 * Returns the processed storage directory for a persona.
 */
export function getProcessedDir(personaId: PipelinePersonaId): string {
  return getPersonaStageDir("processed", personaId);
}

/**
 * Returns the knowledge storage directory for a persona.
 */
export function getKnowledgeDir(personaId: PipelinePersonaId): string {
  return getPersonaStageDir("knowledge", personaId);
}

/**
 * Returns the chunks storage directory for a persona.
 */
export function getChunksDir(personaId: PipelinePersonaId): string {
  return getPersonaStageDir("chunks", personaId);
}

/**
 * Returns the embeddings storage directory for a persona.
 */
export function getEmbeddingsDir(personaId: PipelinePersonaId): string {
  return getPersonaStageDir("embeddings", personaId);
}

/**
 * Ensures a directory exists, creating it recursively when missing.
 *
 * @param dirPath - Absolute or relative directory path
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Ensures all pipeline storage directories exist for a persona.
 *
 * @param personaId - Target persona identifier
 */
export async function ensurePersonaStorageDirs(
  personaId: PipelinePersonaId,
): Promise<void> {
  await Promise.all(
    STORAGE_STAGES.map((stage) => ensureDir(getPersonaStageDir(stage, personaId))),
  );
}

/**
 * Ensures top-level storage stage directories exist.
 */
export async function ensureStorageRoot(): Promise<void> {
  await Promise.all(
    STORAGE_STAGES.map((stage) => ensureDir(path.join(STORAGE_ROOT, stage))),
  );
}

/**
 * Checks whether a file exists at the given path.
 *
 * @param filePath - Absolute path to check
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and parses a JSON file, returning a typed value.
 *
 * @param filePath - Absolute path to the JSON file
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Writes a value to a JSON file with stable formatting.
 *
 * @param filePath - Absolute path to the JSON file
 * @param data - Serializable data to persist
 */
export async function writeJsonFile<T>(
  filePath: string,
  data: T,
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Writes markdown content to a file.
 *
 * @param filePath - Absolute path to the markdown file
 * @param content - Markdown body
 */
export async function writeMarkdownFile(
  filePath: string,
  content: string,
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Builds a file path inside a persona stage directory.
 *
 * @param stage - Pipeline storage stage
 * @param personaId - Target persona identifier
 * @param filename - File name within the stage directory
 */
export function buildStageFilePath(
  stage: StorageStage,
  personaId: PipelinePersonaId,
  filename: string,
): string {
  return path.join(getPersonaStageDir(stage, personaId), filename);
}
