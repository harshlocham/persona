/**
 * A message passed to the chat completion port.
 * System instructions are provided separately via {@link StreamChatParams.systemPrompt}.
 */
export interface ChatCompletionMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/**
 * Input parameters for streaming a persona chat completion.
 */
export interface StreamChatParams {
  readonly systemPrompt: string;
  readonly messages: readonly ChatCompletionMessage[];
}

/**
 * Streaming response from a chat completion request.
 * Framework-agnostic — API routes can adapt `textStream` to HTTP responses.
 */
export interface ChatStreamResponse {
  readonly textStream: ReadableStream<string>;
}

/**
 * Port for streaming AI chat completions.
 * Implemented by infrastructure; consumed by application use cases and API handlers.
 */
export interface ChatCompletionPort {
  /**
   * Streams an assistant reply for the given system prompt and conversation history.
   *
   * @param params - System prompt and message history
   * @returns A streaming response with incremental text chunks
   */
  streamChat(params: StreamChatParams): ChatStreamResponse;
}
