"use client";

import { useState } from "react";

import { Composer } from "@/presentation/components/chat/composer";
import { Header } from "@/presentation/components/chat/header";
import { MessageList } from "@/presentation/components/chat/message-list";
import { usePersonaChat } from "@/presentation/hooks/use-persona-chat";
import { getPersonaThemeStyle } from "@/presentation/lib/persona-theme";
import {
  DEFAULT_PERSONA_ID,
  PERSONA_UI_OPTIONS,
  getPersonaUiOptionById,
} from "@/shared/constants/personas";
import type { PersonaId } from "@/domain/models/persona";

export function ChatLayout() {
  const [personaId, setPersonaId] = useState<PersonaId>(DEFAULT_PERSONA_ID);
  const { messages, sendMessage, stop, status, error } =
    usePersonaChat(personaId);

  const selectedPersona =
    getPersonaUiOptionById(personaId) ?? PERSONA_UI_OPTIONS[0];
  const isBusy = status === "submitted" || status === "streaming";

  async function handleSend(text: string) {
    await sendMessage({ text });
  }

  function handlePersonaChange(nextPersonaId: PersonaId) {
    if (nextPersonaId === personaId) {
      return;
    }

    setPersonaId(nextPersonaId);
  }

  return (
    <div
      className="flex h-dvh flex-col bg-background"
      style={getPersonaThemeStyle(selectedPersona.metadata.accent)}
    >
      <Header
        personas={PERSONA_UI_OPTIONS}
        personaId={personaId}
        onPersonaChange={handlePersonaChange}
        isBusy={isBusy}
      />

      <MessageList
        messages={messages}
        status={status}
        persona={selectedPersona}
        onSuggestedQuestion={handleSend}
      />

      {error ? (
        <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:px-6">
          {error.message}
        </div>
      ) : null}

      <Composer
        status={status}
        onSend={handleSend}
        onStop={stop}
        disabled={false}
      />
    </div>
  );
}
