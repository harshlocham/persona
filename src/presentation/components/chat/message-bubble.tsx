"use client";

import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/presentation/components/chat/markdown-content";
import { getMessageText } from "@/presentation/lib/chat-messages";

interface MessageBubbleProps {
  message: UIMessage;
  personaName?: string;
  isStreaming?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MessageBubble({
  message,
  personaName = "AI",
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
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            {getInitials(personaName)}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border bg-card text-card-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        ) : showLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        ) : (
          <MarkdownContent content={text} />
        )}

        {!isUser && isStreaming && text.length > 0 ? (
          <span className="mt-2 inline-block h-4 w-0.5 animate-pulse bg-primary" />
        ) : null}
      </div>
    </div>
  );
}
