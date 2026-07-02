"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport, type UIMessage } from "ai";
import { useMemo } from "react";

import { toChatApiMessages } from "@/presentation/lib/chat-messages";
import type { PersonaId } from "@/domain/models/persona";

const CHAT_API_PATH = "/api/chat";

/**
 * Persona-scoped chat hook backed by AI SDK `useChat` and `TextStreamChatTransport`.
 * Maps UI messages to the existing POST /api/chat contract.
 */
export function usePersonaChat(personaId: PersonaId) {
  const transport = useMemo(
    () =>
      new TextStreamChatTransport<UIMessage>({
        api: CHAT_API_PATH,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            personaId,
            messages: toChatApiMessages(messages),
          },
        }),
      }),
    [personaId],
  );

  return useChat<UIMessage>({
    id: `persona-chat-${personaId}`,
    transport,
  });
}
