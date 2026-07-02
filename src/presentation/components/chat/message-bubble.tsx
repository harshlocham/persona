"use client";

import type { UIMessage } from "ai";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/presentation/components/chat/markdown-content";
import { ThinkingIndicator } from "@/presentation/components/chat/thinking-indicator";
import { getMessageText } from "@/presentation/lib/chat-messages";
import type { PersonaUiOption } from "@/domain/models/persona";

interface MessageBubbleProps {
  message: UIMessage;
  persona: PersonaUiOption;
  isStreaming?: boolean;
}

export function MessageBubble({
  message,
  persona,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const text = getMessageText(message);
  const showLoading = !isUser && isStreaming && text.length === 0;

  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
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
      ) : null}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%]",
          isUser ? "text-[var(--persona-primary-foreground)]" : "border",
        )}
        style={
          isUser
            ? { backgroundColor: "var(--persona-primary)" }
            : {
                backgroundColor: "var(--persona-bubble)",
                color: "var(--persona-bubble-foreground)",
              }
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        ) : showLoading ? (
          <ThinkingIndicator />
        ) : (
          <MarkdownContent content={text} />
        )}

        {!isUser && isStreaming && text.length > 0 ? (
          <span
            className="mt-2 inline-block h-4 w-0.5 animate-pulse"
            style={{ backgroundColor: "var(--persona-primary)" }}
          />
        ) : null}
      </div>
    </div>
  );
}
