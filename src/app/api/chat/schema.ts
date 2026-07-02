import { z } from "zod";

import { isSupportedPersonaId } from "@/shared/constants/personas";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Message content is required."),
});

const retrievedContextItemSchema = z.object({
  content: z.string().trim().min(1, "Retrieved context content is required."),
  source: z.string().trim().min(1).optional(),
});

export const chatRequestSchema = z.object({
  personaId: z
    .string()
    .trim()
    .min(1, "personaId is required.")
    .refine(isSupportedPersonaId, "personaId is not supported."),
  messages: z
    .array(chatMessageSchema)
    .min(1, "At least one message is required."),
  retrievedContext: z.array(retrievedContextItemSchema).optional().default([]),
  conversationSummary: z.string().optional().default(""),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
