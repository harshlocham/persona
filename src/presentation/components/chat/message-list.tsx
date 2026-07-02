"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useRef } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/presentation/components/chat/message-bubble";
import { SuggestedQuestions } from "@/presentation/components/chat/suggested-questions";
import { ThinkingIndicator } from "@/presentation/components/chat/thinking-indicator";
import type { PersonaUiOption } from "@/domain/models/persona";

interface MessageListProps {
  messages: UIMessage[];
  status: ChatStatus;
  persona: PersonaUiOption;
  onSuggestedQuestion: (question: string) => void;
}

export function MessageList({
  messages,
  status,
  persona,
  onSuggestedQuestion,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "submitted" || status === "streaming";
  const isBusy = isStreaming;
  const showPendingThinking =
    status === "submitted" &&
    messages[messages.length - 1]?.role === "user";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <Avatar className="h-16 w-16">
            <AvatarFallback
              className="text-base font-semibold"
              style={{
                backgroundColor: "var(--persona-muted)",
                color: "var(--persona-primary)",
              }}
            >
              {persona.metadata.avatar.initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{persona.name}</h2>
            <p className="text-sm text-muted-foreground">
              {persona.metadata.displayTitle}
            </p>
            <p className="text-sm text-muted-foreground">{persona.description}</p>
          </div>

          <SuggestedQuestions
            questions={persona.metadata.suggestedQuestions}
            onSelect={onSuggestedQuestion}
            disabled={isBusy}
          />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === "assistant" && index === messages.length - 1;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              persona={persona}
              isStreaming={isLastAssistant && isStreaming}
            />
          );
        })}

        {showPendingThinking ? (
          <div className="flex w-full justify-start gap-3">
            <Avatar className="mt-1 h-8 w-8">
              <AvatarFallback
                className="text-xs font-medium"
                style={{
                  backgroundColor: "var(--persona-muted)",
                  color: "var(--persona-primary)",
                }}
              >
                {persona.metadata.avatar.initials}
              </AvatarFallback>
            </Avatar>
            <div
              className="max-w-[85%] rounded-2xl border px-4 py-3 shadow-sm sm:max-w-[75%]"
              style={{
                backgroundColor: "var(--persona-bubble)",
                color: "var(--persona-bubble-foreground)",
              }}
            >
              <ThinkingIndicator />
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
