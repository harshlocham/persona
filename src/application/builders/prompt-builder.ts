import type { ChatCompletionMessage } from "@/application/ports/chat-completion.port";
import type { Persona } from "@/domain/models/persona";

/**
 * A retrieved document or snippet injected into the system prompt for RAG.
 */
export interface RetrievedContextItem {
  readonly content: string;
  readonly source?: string;
}

/**
 * Input for {@link PromptBuilder.build}.
 */
export interface PromptBuilderInput {
  readonly persona: Persona;
  readonly messages: readonly ChatCompletionMessage[];
  readonly retrievedContext?: readonly RetrievedContextItem[];
  readonly conversationSummary?: string;
}

/**
 * Builds the final system prompt sent to the language model.
 * Extensible for future RAG and memory features.
 */
export interface PromptBuilder {
  /**
   * Composes the system prompt from persona instructions and optional context.
   */
  build(params: PromptBuilderInput): string;
}

const CONVERSATION_SUMMARY_HEADER = "## Conversation Summary";
const RETRIEVED_CONTEXT_HEADER = "## Retrieved Context";

function formatRetrievedContextItem(item: RetrievedContextItem): string {
  const source = item.source?.trim();

  if (source) {
    return `[${source}]\n${item.content.trim()}`;
  }

  return item.content.trim();
}

/**
 * Default {@link PromptBuilder} implementation.
 *
 * Concatenates persona instructions with optional conversation summary
 * and retrieved context blocks.
 */
export class DefaultPromptBuilder implements PromptBuilder {
  build({
    persona,
    messages: _messages,
    retrievedContext = [],
    conversationSummary = "",
  }: PromptBuilderInput): string {
    const sections: string[] = [persona.systemPrompt.trim()];

    const summary = conversationSummary.trim();
    if (summary) {
      sections.push(`${CONVERSATION_SUMMARY_HEADER}\n${summary}`);
    }

    const contextItems = retrievedContext
      .map(formatRetrievedContextItem)
      .filter((item) => item.length > 0);

    if (contextItems.length > 0) {
      sections.push(
        `${RETRIEVED_CONTEXT_HEADER}\n${contextItems.join("\n\n")}`,
      );
    }

    return sections.join("\n\n");
  }
}
