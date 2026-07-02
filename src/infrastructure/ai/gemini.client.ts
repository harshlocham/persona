import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

import type { ChatCompletionMessage } from "@/application/ports/chat-completion.port";
import { getServerEnv, type ServerEnv } from "@/infrastructure/config/env";
import { GeminiConfigurationError } from "@/infrastructure/ai/errors";

/** Default Gemini model used when `GEMINI_MODEL` is not set. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash" as const;

/**
 * Dependencies injected into {@link createGeminiClient} for testability.
 */
export interface GeminiClientDependencies {
  readonly getEnv: () => ServerEnv;
}

/**
 * Input for a Gemini streaming text request.
 */
export interface GeminiStreamTextParams {
  readonly systemPrompt: string;
  readonly messages: readonly ChatCompletionMessage[];
}

/**
 * Low-level Gemini adapter contract.
 * Wraps `@ai-sdk/google` and the AI SDK `streamText` API.
 */
export interface GeminiClient {
  /** Returns the resolved model identifier. */
  getModelId(): string;

  /**
   * Streams a text completion from Gemini.
   *
   * @param params - System prompt and conversation messages
   * @returns AI SDK streaming result
   */
  streamText(
    params: GeminiStreamTextParams,
  ): ReturnType<typeof streamText>;
}

interface ResolvedGeminiConfig {
  readonly provider: ReturnType<typeof createGoogleGenerativeAI>;
  readonly modelId: string;
}

/**
 * Creates a Gemini client backed by `@ai-sdk/google`.
 *
 * Reads the API key and model from {@link getServerEnv} by default.
 * Pass custom dependencies in tests to avoid touching real environment variables.
 *
 * @param deps - Optional dependency overrides
 * @returns Configured {@link GeminiClient} instance
 *
 * @example
 * ```ts
 * const client = createGeminiClient();
 * const result = client.streamText({
 *   systemPrompt: "You are a helpful assistant.",
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 *
 * for await (const chunk of result.textStream) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export function createGeminiClient(
  deps: GeminiClientDependencies = { getEnv: getServerEnv },
): GeminiClient {
  let cachedConfig: ResolvedGeminiConfig | undefined;

  function resolveConfig(): ResolvedGeminiConfig {
    if (cachedConfig) {
      return cachedConfig;
    }

    try {
      const env = deps.getEnv();
      const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY.trim();

      if (!apiKey) {
        throw new GeminiConfigurationError(
          "GOOGLE_GENERATIVE_AI_API_KEY is missing or empty.",
        );
      }

      const modelId = env.GEMINI_MODEL.trim() || DEFAULT_GEMINI_MODEL;

      cachedConfig = {
        provider: createGoogleGenerativeAI({ apiKey }),
        modelId,
      };

      return cachedConfig;
    } catch (error) {
      if (error instanceof GeminiConfigurationError) {
        throw error;
      }

      throw new GeminiConfigurationError(
        "Failed to initialize Gemini client. Verify server environment configuration.",
        error,
      );
    }
  }

  return {
    getModelId(): string {
      return resolveConfig().modelId;
    },

    streamText(params: GeminiStreamTextParams): ReturnType<typeof streamText> {
      const { provider, modelId } = resolveConfig();

      return streamText({
        model: provider(modelId),
        system: params.systemPrompt,
        messages: params.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });
    },
  };
}
