import { createTextStreamResponse } from "ai";

import { PersonaNotFoundError } from "@/application/errors";
import { chatRequestSchema } from "@/app/api/chat/schema";
import { toPersonaId } from "@/domain/models/persona";
import { sendChatMessageUseCase } from "@/infrastructure/composition";
import {
  ChatCompletionValidationError,
  GeminiConfigurationError,
} from "@/infrastructure/ai/errors";

/**
 * POST /api/chat
 *
 * Validates the request, delegates to {@link SendChatMessageUseCase},
 * and returns an AI SDK text stream response.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const { textStream } = sendChatMessageUseCase.execute({
      personaId: toPersonaId(parsed.data.personaId),
      messages: parsed.data.messages,
      retrievedContext: parsed.data.retrievedContext,
      conversationSummary: parsed.data.conversationSummary,
    });

    return createTextStreamResponse({ stream: textStream });
  } catch (error) {
    if (error instanceof PersonaNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ChatCompletionValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof GeminiConfigurationError) {
      return Response.json(
        { error: "Chat service is not configured." },
        { status: 500 },
      );
    }

    console.error("[POST /api/chat]", error);

    return Response.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
