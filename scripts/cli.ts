#!/usr/bin/env node

import { loadEnvFiles } from "./shared/load-env.js";

loadEnvFiles();

import * as chunk from "./chunk/index.js";
import * as collect from "./collect/index.js";
import * as embed from "./embed/index.js";
import * as processStage from "./process/index.js";
import * as resources from "./resources/index.js";
import * as summarize from "./summarize/index.js";
import { getPersonaConfig } from "./config/personas.js";
import {
  PIPELINE_COMMANDS,
  PIPELINE_PERSONA_IDS,
  ensureStorageRoot,
  logger,
  type PipelineCommand,
} from "./shared/index.js";

const BUILD_STAGE_ORDER = [
  "collect",
  "process",
  "summarize",
  "chunk",
  "embed",
  "resources",
] as const;

interface ParsedCliArgs {
  readonly command: PipelineCommand;
  readonly personaId: string;
  readonly force: boolean;
  readonly buildOnly: boolean;
}

/**
 * Prints CLI usage instructions.
 */
function printUsage(): void {
  const commands = PIPELINE_COMMANDS.join(" | ");
  const personas = PIPELINE_PERSONA_IDS.join(" | ");

  console.log(`Usage: pnpm persona <command> <personaId> [--force]

Commands:
  ${commands}

Options:
  --force        Reprocess/re-embed existing outputs instead of skipping
  --build-only   (resources) Write the catalog to storage without embedding

Personas:
  ${personas}

Examples:
  pnpm persona collect hitesh
  pnpm persona collect hitesh --force
  pnpm persona process piyush
  pnpm persona process piyush --force
  pnpm persona summarize piyush
  pnpm persona summarize piyush --force
  pnpm persona chunk piyush
  pnpm persona chunk piyush --force
  pnpm persona embed piyush
  pnpm persona embed piyush --force
  pnpm persona resources piyush
  pnpm persona resources piyush --force
  pnpm persona build piyush`);
}

/**
 * Parses CLI arguments into command, persona ID, and flags.
 *
 * @param argv - Process argv slice
 */
function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  const filtered = argv.filter((arg) => arg !== "--");
  const force = filtered.includes("--force");
  const buildOnly = filtered.includes("--build-only");
  const positional = filtered.filter(
    (arg) => arg !== "--force" && arg !== "--build-only",
  );
  const [commandArg, personaId] = positional;

  if (!commandArg) {
    throw new Error("Missing command.");
  }

  if (!personaId) {
    throw new Error("Missing personaId argument.");
  }

  if (!(PIPELINE_COMMANDS as readonly string[]).includes(commandArg)) {
    throw new Error(
      `Unknown command "${commandArg}". Supported: ${PIPELINE_COMMANDS.join(", ")}`,
    );
  }

  return {
    command: commandArg as PipelineCommand,
    personaId,
    force,
    buildOnly,
  };
}

/**
 * Runs all pipeline stages sequentially for a persona.
 *
 * @param personaId - Target persona identifier
 * @param force - Whether to overwrite existing collected files
 */
async function runBuild(personaId: string, force: boolean): Promise<void> {
  const config = getPersonaConfig(personaId);

  logger.info("Starting full pipeline build", {
    personaId: config.id,
    displayName: config.displayName,
    force,
    stages: BUILD_STAGE_ORDER,
  });

  await collect.run(personaId, { force });
  await processStage.run(personaId, { force });
  await summarize.run(personaId, { force });
  await chunk.run(personaId, { force });
  await embed.run(personaId, { force });
  await resources.run(personaId, { force });

  logger.info("Full pipeline build complete", {
    personaId: config.id,
  });
}

/**
 * CLI entrypoint for the persona knowledge pipeline.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const { command, personaId, force, buildOnly } = parseCliArgs(argv);

  await ensureStorageRoot();

  if (command === "build") {
    await runBuild(personaId, force);
    return;
  }

  if (command === "collect") {
    await collect.run(personaId, { force });
    return;
  }

  if (command === "process") {
    await processStage.run(personaId, { force });
    return;
  }

  if (command === "summarize") {
    await summarize.run(personaId, { force });
    return;
  }

  if (command === "chunk") {
    await chunk.run(personaId, { force });
    return;
  }

  if (command === "embed") {
    await embed.run(personaId, { force });
    return;
  }

  if (command === "resources") {
    await resources.run(personaId, { force, buildOnly });
    return;
  }

  throw new Error(`Unhandled command "${command}".`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Pipeline command failed", { error: message });
  process.exit(1);
});
