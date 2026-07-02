# Context Management

How the runtime assembles the right context for every request — retrieval,
filtering, budgeting, de-duplication, and conversation memory — without letting
grounding material crowd out the persona instructions or the model's context
window.

## Request lifecycle

```
Browser
  │  POST /api/chat { personaId, messages[] }
  ▼
src/app/api/chat/route.ts        — Zod-validate body, map to PersonaId
  ▼
SendChatMessageUseCase.execute   — orchestration (application layer)
  ├─ personaRepository.getById   — load persona (identity + voice content)
  ├─ detectResourceIntent(query) — heuristic: wantsResources? type? topics?
  ├─ retrievalPort.retrieve(...)  — server-side, persona-scoped RAG
  ├─ promptBuilder.build(...)     — assemble system prompt
  └─ chatCompletionPort.streamChat — Gemini streaming
  ▼
createTextStreamResponse         — stream tokens back to the browser (SSE)
```

Key property: **retrieval and persona are decided server-side**. The client only
sends `personaId` and `messages` — it can never inject grounding context or
change the persona filter.

## Retrieval (QdrantRetrievalService)

`src/infrastructure/retrieval/qdrant-retrieval.service.ts`

1. **Embed the query** with `gemini-embedding-001`, task type
   **`RETRIEVAL_QUERY`** (matched to the `RETRIEVAL_DOCUMENT` type used at index
   time — this asymmetry improves retrieval quality).
2. **Search two collections in parallel:**
   - `persona_knowledge` — top **6**, hard-filtered by `persona`.
   - `persona_resources` — top **5**, filtered by `persona` (+ `type` when the
     user asked for a specific format), **only when resource intent is detected**.
3. **Map** hits to typed results (text + source + score for knowledge; full
   catalog fields for resources).
4. **Score sufficiency** and return.

### Hard persona filtering

Every search includes `filter: { must: [{ key: "persona", match: { value } }] }`.
This is the guarantee that persona A never sees persona B's content. Qdrant Cloud
**requires a keyword payload index** on any filtered field, so the pipeline
creates indexes on `persona` (both collections) and `type` (resources).

### Graceful degradation

Both searches are wrapped so any failure resolves to an empty list, and the
whole `retrieve` is try/caught to return an empty result. Chat therefore never
crashes on a retrieval error — it falls back to the disclosed-general-knowledge
policy in the prompt.

## Intent-aware retrieval

`detectResourceIntent` (`src/application/services/resource-intent.ts`) is a
lightweight, dependency-free classifier (a stand-in for an LLM classifier):

- **`wantsResources`** — true when the message contains triggers like
  *recommend, suggest, video, playlist, course, tutorial, roadmap, how can/should
  I learn*.
- **`resourceType`** — `video | playlist | course | blog` when specified.
- **`topicHints`** — subject topics (backend, react, system-design, …).

Knowledge retrieval runs for **every** request; resource retrieval runs **only**
when `wantsResources` is true — so casual questions don't get spammed with links,
and explicit "recommend a course" requests do.

> Note: phrasings like *"I want to learn X"* are not currently triggers (only
> *"how can/should I learn X"* is). Broadening this is a known, easy improvement.

## Context assembly & budgeting

The prompt builder controls how retrieved text enters the prompt:

- **Character budget** — the Retrieved Knowledge block is capped at
  `MAX_CONTEXT_CHARS = 6000`. Snippets are added until the budget is hit, then
  the rest are dropped. Persona identity/voice instructions are always kept, so
  grounding can never crowd them out or overflow the window.
- **De-duplication** — overlapping chunks share text, so each snippet is
  fingerprinted (lowercased, whitespace-collapsed) and near-duplicates are
  skipped.
- **Source labels** — each snippet is prefixed with its source title/URL.
- **Precedence** — the behavioral contract fixes conflict resolution order
  (identity → resources → retrieved knowledge → persona knowledge → summary).
- **Query echo** — the closing anchor echoes the latest user turn (truncated to
  `MAX_QUERY_ECHO_CHARS = 500`).

## Conversation memory

- The **full message history** (`messages[]`) is sent to Gemini on each request,
  so within a session the model has the running turn-by-turn context.
- The prompt builder also supports a `conversationSummary` block for longer-term
  compressed memory. The field is wired through the builder but not currently
  populated by the use case — it's the extension point for summarize-older-turns
  memory as conversations grow past a token budget.
- Retrieval currently uses only the **latest** user message as the query. A
  future improvement is to condense recent turns into the retrieval query for
  better follow-up handling.

## Environment variables

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | app + scripts | — | Gemini chat + embeddings (required) |
| `GEMINI_MODEL` | app | `gemini-2.5-flash` | Chat model |
| `EMBEDDING_MODEL` | app + scripts | `gemini-embedding-001` | Embedding model |
| `EMBEDDING_DIMENSIONS` | app + scripts | `768` | Vector size |
| `QDRANT_URL` | app + scripts | `http://localhost:6333` | Vector DB endpoint |
| `QDRANT_API_KEY` | app + scripts | — | Qdrant Cloud key (optional locally) |
| `QDRANT_COLLECTION` | app + scripts | `persona_knowledge` | Knowledge collection |
| `RESOURCES_COLLECTION` | app + scripts | `persona_resources` | Resource collection |
| `YOUTUBE_API_KEY` | scripts | — | Required for `collect` |
| `EMBEDDING_BATCH_SIZE` | scripts | `64` | Items per embed batch |
| `EMBEDDING_REQUESTS_PER_MINUTE` | scripts | `90` | Embed pacing / throttle |

## Tuning knobs

| Constant | Location | Default |
|---|---|---|
| `KNOWLEDGE_TOP_K` | qdrant-retrieval.service.ts | 6 |
| `RESOURCE_TOP_K` | qdrant-retrieval.service.ts | 5 |
| `STRONG_SCORE_THRESHOLD` | qdrant-retrieval.service.ts | 0.72 |
| `MAX_CONTEXT_CHARS` | prompt-builder.ts | 6000 |
| `MAX_QUERY_ECHO_CHARS` | prompt-builder.ts | 500 |
