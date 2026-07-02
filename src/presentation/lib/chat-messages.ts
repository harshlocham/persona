import type { ChatCompletionMessage } from "@/application/ports/chat-completion.port";
import type { UIMessage } from "ai";

/**
 * Extracts plain text from a UI message's parts.
 */
export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * Converts UI messages to the API request message format.
 */
export function toChatApiMessages(
  messages: readonly UIMessage[],
): ChatCompletionMessage[] {
  return messages
    .filter(
      (message): message is UIMessage & { role: "user" | "assistant" } =>
        message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      role: message.role,
      content: getMessageText(message),
    }))
    .filter((message) => message.content.trim().length > 0);
}
