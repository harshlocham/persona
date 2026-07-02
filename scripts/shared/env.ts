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
