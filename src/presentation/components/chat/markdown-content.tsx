"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renders assistant markdown with GFM and syntax-highlighted code blocks.
 *
 * Prose colors derive from the surrounding bubble's `currentColor` (the persona
 * bubble foreground) rather than the OS color scheme, so the text stays legible
 * on the fixed light bubble background in both light and dark modes.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-sm leading-relaxed",
        "[--tw-prose-body:currentColor] [--tw-prose-headings:currentColor]",
        "[--tw-prose-bold:currentColor] [--tw-prose-quotes:currentColor]",
        "[--tw-prose-bullets:currentColor] [--tw-prose-counters:currentColor]",
        "[--tw-prose-hr:color-mix(in_srgb,currentColor_25%,transparent)]",
        "[--tw-prose-quote-borders:color-mix(in_srgb,currentColor_25%,transparent)]",
        "[--tw-prose-links:var(--persona-primary)] prose-a:font-medium",
        "prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-zinc-900 prose-pre:p-4 prose-pre:text-zinc-100",
        "prose-code:rounded prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:text-inherit prose-code:before:content-none prose-code:after:content-none",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
