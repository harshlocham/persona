import { z } from "zod";

import { pipelinePersonaIdSchema } from "../shared/schemas.js";
import type { PipelinePersonaId } from "../shared/types.js";

/**
 * Source endpoints configured for a persona knowledge pipeline.
 */
export interface PersonaSourceConfig {
  readonly websites: readonly string[];
  readonly youtubeChannels: readonly string[];
  readonly youtubePlaylists: readonly string[];
  readonly blogs: readonly string[];
}

/**
 * Full persona configuration for the knowledge pipeline.
 */
export interface PersonaPipelineConfig {
  readonly id: PipelinePersonaId;
  readonly displayName: string;
  readonly sources: PersonaSourceConfig;
}

const personaSourceConfigSchema = z.object({
  websites: z.array(z.string()),
  youtubeChannels: z.array(z.string()),
  youtubePlaylists: z.array(z.string()),
  blogs: z.array(z.string()),
});

const personaPipelineConfigSchema = z.object({
  id: pipelinePersonaIdSchema,
  displayName: z.string().min(1),
  sources: personaSourceConfigSchema,
});

/**
 * Registered persona pipeline configurations.
 * URLs are intentionally empty until sources are curated.
 */
export const PERSONA_PIPELINE_CONFIGS: readonly PersonaPipelineConfig[] = [
  {
    id: "hitesh",
    displayName: "Hitesh Choudhary",
    sources: {
      websites: ["https://hitesh.ai"],
      youtubeChannels: ["@chaiaurcode"],
      youtubePlaylists: ["PLu71SKxNbfoDqgPchmvIsL4hTnJIrtige&si=RjX0FfkA4zBM8S6a"],
      blogs: [],
    },
  },
  {
    id: "piyush",
    displayName: "Piyush Garg",
    sources: {
      websites: ["https://www.piyushgarg.dev"],
      youtubeChannels: ["@piyushgargdev"],
      youtubePlaylists: ["PLinedj3B30sCaD2wxnjJs26o3rTFdNah_"],
      blogs: [],
    },
  },
] as const;

/** Map of persona ID to pipeline configuration. */
export const PERSONA_CONFIG_BY_ID: Readonly<
  Record<PipelinePersonaId, PersonaPipelineConfig>
> = Object.fromEntries(
  PERSONA_PIPELINE_CONFIGS.map((config) => [config.id, config]),
) as Record<PipelinePersonaId, PersonaPipelineConfig>;

/**
 * Returns the pipeline configuration for a persona.
 *
 * @param personaId - Target persona identifier
 * @throws {Error} When the persona ID is not registered
 */
export function getPersonaConfig(personaId: string): PersonaPipelineConfig {
  const result = pipelinePersonaIdSchema.safeParse(personaId);

  if (!result.success) {
    throw new Error(
      `Unknown persona "${personaId}". Supported: ${pipelinePersonaIdSchema.options.join(", ")}`,
    );
  }

  return PERSONA_CONFIG_BY_ID[result.data];
}

/**
 * Validates a persona pipeline configuration object.
 *
 * @param config - Configuration to validate
 */
export function parsePersonaConfig(
  config: unknown,
): PersonaPipelineConfig {
  return personaPipelineConfigSchema.parse(config);
}
