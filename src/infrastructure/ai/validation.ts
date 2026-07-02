import type { StreamChatParams } from "@/application/ports/chat-completion.port";
import { ChatCompletionValidationError } from "@/infrastructure/ai/errors";

/**
 * Validates parameters before invoking the Gemini streaming API.
 *
 * @throws {ChatCompletionValidationError} When input is malformed
 */
export function validateStreamChatParams(params: StreamChatParams): void {
  const systemPrompt = params.systemPrompt.trim();

  if (!systemPrompt) {
    throw new ChatCompletionValidationError(
      "systemPrompt must be a non-empty string.",
      "systemPrompt",
    );
  }

  if (params.messages.length === 0) {
    throw new ChatCompletionValidationError(
      "messages must contain at least one message.",
      "messages",
    );
  }

  params.messages.forEach((message, index) => {
    if (message.role !== "user" && message.role !== "assistant") {
      throw new ChatCompletionValidationError(
        `messages[${index}].role must be "user" or "assistant".`,
        `messages[${index}].role`,
      );
    }

    if (!message.content.trim()) {
      throw new ChatCompletionValidationError(
        `messages[${index}].content must be a non-empty string.`,
        `messages[${index}].content`,
      );
    }
  });
}
