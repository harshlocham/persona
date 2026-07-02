"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Rotating status labels shown while the assistant is generating a reply.
 * They advance the perceived progress from "reading" to "composing" so the
 * wait feels like reasoning rather than a frozen spinner.
 */
const THINKING_PHASES = [
  "Thinking",
  "Reasoning through your question",
  "Pulling up the right examples",
  "Putting it together",
] as const;

const PHASE_INTERVAL_MS = 2200;

/**
 * Inline "assistant is thinking" content: a spinner, a rotating status label,
 * and animated dots. Rendered inside a message bubble (avatar/bubble supplied
 * by the caller).
 */
export function ThinkingIndicator() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((previous) => (previous + 1) % THINKING_PHASES.length);
    }, PHASE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm opacity-70">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{THINKING_PHASES[phase]}</span>
      <span className="inline-flex items-center gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
      </span>
    </div>
  );
}
