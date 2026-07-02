import { DefaultPromptBuilder } from "@/application/builders/prompt-builder";
import { PersonaNotFoundError } from "@/application/errors";
import type {
  ChatCompletionMessage,
  ChatCompletionPort,
  ChatStreamResponse,
} from "@/application/ports/chat-completion.port";
import type { PersonaRepository } from "@/application/ports";
import type {
  RetrievalPort,
  RetrievedKnowledgeItem,
} from "@/application/ports/retrieval.port";
import type {
  PromptBuilder,
  RetrievedContextItem,
} from "@/application/builders/prompt-builder";
import { detectResourceIntent } from "@/application/services/resource-intent";
import type { PersonaId } from "@/domain/models/persona";

/**
 * Input for {@link SendChatMessageUseCase.execute}.
 */
export interface SendChatMessageInput {
  readonly personaId: PersonaId;
  readonly messages: readonly ChatCompletionMessage[];
}

function latestUserMessage(
  messages: readonly ChatCompletionMessage[],
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return messages[index].content;
    }
  }

  return "";
}

function toContextItem(item: RetrievedKnowledgeItem): RetrievedContextItem {
  return { content: item.content, source: item.source };
}

/**
 * Orchestrates persona lookup, server-side retrieval, prompt construction, and
 * streaming chat completion.
 */
export class SendChatMessageUseCase {
  constructor(
    private readonly personaRepository: PersonaRepository,
    private readonly chatCompletionPort: ChatCompletionPort,
    private readonly retrievalPort: RetrievalPort,
    private readonly promptBuilder: PromptBuilder = new DefaultPromptBuilder(),
  ) {}

  /**
   * Loads a persona, retrieves persona-scoped knowledge and resources, builds
   * the grounded system prompt, and streams an assistant reply.
   *
   * @param input - Persona ID and message history
   * @returns Streaming text response from the chat completion port
   *
   * @throws {PersonaNotFoundError} When the persona ID is not recognized
   */
  async execute(input: SendChatMessageInput): Promise<ChatStreamResponse> {
    const persona = this.personaRepository.getById(input.personaId);

    if (!persona) {
      throw new PersonaNotFoundError(input.personaId);
    }

    const query = latestUserMessage(input.messages);
    const intent = detectResourceIntent(query);

    const retrieval = await this.retrievalPort.retrieve({
      personaId: input.personaId,
      query,
      wantsResources: intent.wantsResources,
      resourceType: intent.resourceType,
      topicHints: intent.topicHints,
    });

    const systemPrompt = this.promptBuilder.build({
      persona,
      messages: input.messages,
      retrievedContext: retrieval.knowledge.map(toContextItem),
      resources: retrieval.resources,
      sufficiency: retrieval.sufficiency,
    });

    return this.chatCompletionPort.streamChat({
      systemPrompt,
      messages: input.messages,
    });
  }
}
