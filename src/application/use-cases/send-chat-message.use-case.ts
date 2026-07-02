import { DefaultPromptBuilder } from "@/application/builders/prompt-builder";
import { PersonaNotFoundError } from "@/application/errors";
import type {
  ChatCompletionMessage,
  ChatCompletionPort,
  ChatStreamResponse,
} from "@/application/ports/chat-completion.port";
import type { PersonaRepository } from "@/application/ports";
import type { PromptBuilder } from "@/application/builders/prompt-builder";
import type { RetrievedContextItem } from "@/application/builders/prompt-builder";
import type { PersonaId } from "@/domain/models/persona";

/**
 * Input for {@link SendChatMessageUseCase.execute}.
 */
export interface SendChatMessageInput {
  readonly personaId: PersonaId;
  readonly messages: readonly ChatCompletionMessage[];
  readonly retrievedContext?: readonly RetrievedContextItem[];
  readonly conversationSummary?: string;
}

/**
 * Orchestrates persona lookup, prompt construction, and streaming chat completion.
 */
export class SendChatMessageUseCase {
  constructor(
    private readonly personaRepository: PersonaRepository,
    private readonly chatCompletionPort: ChatCompletionPort,
    private readonly promptBuilder: PromptBuilder = new DefaultPromptBuilder(),
  ) {}

  /**
   * Loads a persona, builds the system prompt, and streams an assistant reply.
   *
   * @param input - Persona ID, message history, and optional RAG context
   * @returns Streaming text response from the chat completion port
   *
   * @throws {PersonaNotFoundError} When the persona ID is not recognized
   */
  execute(input: SendChatMessageInput): ChatStreamResponse {
    const persona = this.personaRepository.getById(input.personaId);

    if (!persona) {
      throw new PersonaNotFoundError(input.personaId);
    }

    const systemPrompt = this.promptBuilder.build({
      persona,
      messages: input.messages,
      retrievedContext: input.retrievedContext,
      conversationSummary: input.conversationSummary,
    });

    return this.chatCompletionPort.streamChat({
      systemPrompt,
      messages: input.messages,
    });
  }
}
