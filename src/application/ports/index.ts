import type { CreateChatMessageInput, ChatMessage } from "@/domain/models/message";
import type { Persona } from "@/domain/models/persona";

export type {
  ChatCompletionMessage,
  ChatCompletionPort,
  ChatStreamResponse,
  StreamChatParams,
} from "@/application/ports/chat-completion.port";

/**
 * Port for retrieving persona definitions.
 * Infrastructure layer will implement; application layer depends on this interface.
 */
export interface PersonaRepository {
  getAll(): readonly Persona[];
  getById(id: Persona["id"]): Persona | undefined;
}

/**
 * Port for persisting and retrieving chat messages within a session.
 */
export interface ChatMessageRepository {
  create(input: CreateChatMessageInput): ChatMessage;
  getByPersonaId(personaId: Persona["id"]): readonly ChatMessage[];
}
