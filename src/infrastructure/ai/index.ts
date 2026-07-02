export {
  ChatCompletionService,
  chatCompletionService,
} from "@/infrastructure/ai/chat-completion.service";
export {
  ChatCompletionValidationError,
  GeminiConfigurationError,
} from "@/infrastructure/ai/errors";
export {
  DEFAULT_GEMINI_MODEL,
  createGeminiClient,
  type GeminiClient,
  type GeminiClientDependencies,
  type GeminiStreamTextParams,
} from "@/infrastructure/ai/gemini.client";
