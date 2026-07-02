import { z } from "zod";

import { isSupportedPersonaId } from "@/shared/constants/personas";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Message content is required."),
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
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
