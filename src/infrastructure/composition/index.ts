import { DefaultPromptBuilder } from "@/application/builders/prompt-builder";
import { SendChatMessageUseCase } from "@/application/use-cases/send-chat-message.use-case";
import { chatCompletionService } from "@/infrastructure/ai/chat-completion.service";
import { personaRepository } from "@/infrastructure/repositories/persona.repository";
import { qdrantRetrievalService } from "@/infrastructure/retrieval";

/**
 * Application composition root.
 * Wires infrastructure implementations to application use cases.
 */
export const sendChatMessageUseCase = new SendChatMessageUseCase(
  personaRepository,
  chatCompletionService,
  qdrantRetrievalService,
  new DefaultPromptBuilder(),
);
