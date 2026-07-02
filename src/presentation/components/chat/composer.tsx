"use client";

import { ArrowUp, Square } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatStatus } from "ai";

interface ComposerProps {
  status: ChatStatus;
  onSend: (text: string) => Promise<void>;
  onStop: () => Promise<void>;
  disabled?: boolean;
}

export function Composer({
  status,
  onSend,
  onStop,
  disabled = false,
}: ComposerProps) {
  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isBusy || disabled) {
      return;
    }

    setInput("");
    await onSend(text);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t bg-background/80 px-4 py-4 backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message your persona..."
          rows={1}
          disabled={disabled || isBusy}
          className="min-h-[52px] max-h-40 resize-none"
        />

        {isBusy ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => void onStop()}
            aria-label="Stop generating"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={disabled || input.trim().length === 0}
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for a new line.
      </p>
    </form>
  );
}
