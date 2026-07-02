#!/usr/bin/env node

import { loadEnvFiles } from "./shared/load-env.js";

loadEnvFiles();

import * as collect from "./collect/index.js";
import * as embed from "./embed/index.js";
import * as processStage from "./process/index.js";
import * as summarize from "./summarize/index.js";
import { getPersonaConfig } from "./config/personas.js";
import {
  PIPELINE_COMMANDS,
  PIPELINE_PERSONA_IDS,
  ensureStorageRoot,
  logger,
  type PipelineCommand,
} from "./shared/index.js";

const STAGES_IN_ORDER = [
  { name: "collect", run: collect.run },
  { name: "process", run: processStage.run },
  { name: "summarize", run: summarize.run },
  { name: "embed", run: embed.run },
] as const;

interface ParsedCliArgs {
  readonly command: PipelineCommand;
  readonly personaId: string;
  readonly force: boolean;
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
  --force    Overwrite existing collected raw documents

Personas:
  ${personas}

Examples:
  pnpm persona collect hitesh
  pnpm persona collect hitesh --force
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
  const positional = filtered.filter((arg) => arg !== "--force");
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
    stages: STAGES_IN_ORDER.map((stage) => stage.name),
  });

  for (const stage of STAGES_IN_ORDER) {
    if (stage.name === "collect") {
      await collect.run(personaId, { force });
      continue;
    }

    await stage.run(personaId);
  }

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

  const { command, personaId, force } = parseCliArgs(argv);

  await ensureStorageRoot();

  if (command === "build") {
    await runBuild(personaId, force);
    return;
  }

  if (command === "collect") {
    await collect.run(personaId, { force });
    return;
  }

  if (force) {
    logger.warn("--force is only applied to collect/build commands");
  }

  const runners: Record<
    Exclude<PipelineCommand, "build" | "collect">,
    (personaId: string) => Promise<void>
  > = {
    process: processStage.run,
    summarize: summarize.run,
    embed: embed.run,
  };

  await runners[command](personaId);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Pipeline command failed", { error: message });
  process.exit(1);
});
