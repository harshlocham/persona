import type {
  ChatCompletionPort,
  ChatStreamResponse,
  StreamChatParams,
} from "@/application/ports/chat-completion.port";
import {
  createGeminiClient,
  type GeminiClient,
} from "@/infrastructure/ai/gemini.client";
import { createDevanagariGuard } from "@/infrastructure/ai/transliteration";
import { validateStreamChatParams } from "@/infrastructure/ai/validation";

/**
 * Infrastructure implementation of {@link ChatCompletionPort}.
 *
 * Delegates streaming to a {@link GeminiClient} while keeping the application
 * layer decoupled from `@ai-sdk/google` and the Vercel AI SDK.
 */
export class ChatCompletionService implements ChatCompletionPort {
  constructor(private readonly geminiClient: GeminiClient = createGeminiClient()) {}

  /**
   * Streams an assistant reply using the configured Gemini model.
   *
   * @param params - Persona system prompt and conversation history
   * @returns Streaming text chunks suitable for SSE or UI consumption
   *
   * @throws {ChatCompletionValidationError} When input parameters are invalid
   * @throws {GeminiConfigurationError} When Gemini is misconfigured
   *
   * @example
   * ```ts
   * const service = new ChatCompletionService();
   *
   * const { textStream } = service.streamChat({
   *   systemPrompt: built from persona.promptProfile via PromptBuilder,
   *   messages: [{ role: "user", content: "Explain clean architecture." }],
   * });
   *
   * for await (const chunk of textStream) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  streamChat(params: StreamChatParams): ChatStreamResponse {
    validateStreamChatParams(params);

    const result = this.geminiClient.streamText({
      systemPrompt: params.systemPrompt.trim(),
      messages: params.messages.map((message) => ({
        role: message.role,
        content: message.content.trim(),
      })),
    });

    return {
      textStream: result.textStream.pipeThrough(createDevanagariGuard()),
    };
  }
}

/**
 * Default singleton for server-side usage.
 * Inject a custom {@link GeminiClient} in tests via `new ChatCompletionService(mockClient)`.
 */
export const chatCompletionService = new ChatCompletionService();
