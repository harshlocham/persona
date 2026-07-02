"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/presentation/components/chat/message-bubble";

interface MessageListProps {
  messages: UIMessage[];
  status: ChatStatus;
  personaName: string;
}

export function MessageList({
  messages,
  status,
  personaName,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <h2 className="text-lg font-medium">Start a conversation</h2>
          <p className="text-sm text-muted-foreground">
            Ask {personaName} anything. Responses stream in real time with
            markdown and code highlighting.
          </p>
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
              personaName={personaName}
              isStreaming={isLastAssistant && isStreaming}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
