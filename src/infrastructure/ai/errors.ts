/**
 * Thrown when Gemini client configuration is missing or invalid.
 */
export class GeminiConfigurationError extends Error {
  readonly name = "GeminiConfigurationError";

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Thrown when chat completion input fails validation before reaching the model.
 */
export class ChatCompletionValidationError extends Error {
  readonly name = "ChatCompletionValidationError";

  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}
