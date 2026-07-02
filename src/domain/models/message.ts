import type { PersonaId } from "@/domain/models/persona";

/**
 * Branded type for chat message identifiers.
 */
export type MessageId = string & { readonly __brand: "MessageId" };

export function toMessageId(id: string): MessageId {
  return id as MessageId;
}

/**
 * Supported roles in a persona chat conversation.
 * Aligns with AI SDK message roles for streaming compatibility.
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Core chat message entity.
 */
export interface ChatMessage {
  readonly id: MessageId;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;
  readonly personaId: PersonaId;
}

/**
 * Input shape for creating a new chat message (before persistence).
 */
export interface CreateChatMessageInput {
  readonly role: MessageRole;
  readonly content: string;
  readonly personaId: PersonaId;
}
