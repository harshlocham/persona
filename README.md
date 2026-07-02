# Persona — Grounded AI Personas for Chai aur Code Educators

An AI chat application that answers **in the voice of real programming educators**
(Hitesh Choudhary and Piyush Garg) and grounds its answers and resource
recommendations in the creators' own public content — not generic internet
knowledge.

The system is a Retrieval-Augmented Generation (RAG) app:

- An **offline ETL pipeline** collects the creators' public YouTube content,
  cleans and structures it, and embeds it into a Qdrant vector database.
- A **runtime layer** (Next.js) retrieves persona-scoped knowledge and
  persona-owned resources for every question, then builds an imitation-focused
  system prompt so the model responds in-character and stays grounded.

## Documentation

| Topic | Doc |
|---|---|
| How persona data is collected and prepared | [`docs/data-pipeline.md`](docs/data-pipeline.md) |
| Prompt engineering strategy | [`docs/prompt-engineering.md`](docs/prompt-engineering.md) |
| Context management (retrieval, budgeting, memory) | [`docs/context-management.md`](docs/context-management.md) |
| Sample conversations (both personas) | [`docs/sample-conversations.md`](docs/sample-conversations.md) |

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Vercel AI SDK** (`ai`, `@ai-sdk/google`) — streaming chat with **Google Gemini**
  (`gemini-2.5-flash` for chat, `gemini-embedding-001` for embeddings)
- **Qdrant** vector database (`@qdrant/js-client-rest`)
- **Zod** for schema validation
- **Tailwind CSS v4** + Radix UI for the chat interface
- **tsx** for the ETL CLI

## Architecture at a glance

```
                        OFFLINE (pnpm persona ...)
 YouTube ─► collect ─► process ─► summarize ─► chunk ─► embed ─────┐
 (curated courses) ───────────────────────────────► resources ─┐  │
                                                               ▼  ▼
                                                          ┌──────────────┐
                                                          │   Qdrant     │
                                                          │ persona_*    │
                                                          └──────────────┘
                        RUNTIME (Next.js)                        ▲
 Browser ─► POST /api/chat ─► SendChatMessageUseCase ─► Retrieval┘
                                     │
                                     ├─► intent detection
                                     ├─► PromptBuilder (identity + grounding)
                                     └─► Gemini stream ─► SSE ─► Browser
```

The codebase follows a ports-and-adapters (hexagonal) layout:

- `src/domain` — persona entities
- `src/application` — use cases, ports, prompt builder, services
- `src/infrastructure` — Gemini + Qdrant adapters, config, composition root
- `src/data` — persona definitions and per-persona voice content
- `scripts/` — the ETL pipeline CLI

## Prerequisites

- **Node.js** 20+
- **pnpm** 11 (`packageManager` is pinned in `package.json`)
- **Docker** (for a local Qdrant) or a **Qdrant Cloud** cluster
- API keys:
  - **Google Gemini** (`GOOGLE_GENERATIVE_AI_API_KEY`) — chat + embeddings
  - **YouTube Data API v3** (`YOUTUBE_API_KEY`) — only needed to re-run the
    `collect` stage

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy the example and fill in values:

```bash
cp .env.example .env.local
```

`.env.local` (loaded automatically by both the app and the ETL CLI):

```bash
# Required — chat + embeddings
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key

# Required only to re-run the `collect` ETL stage
YOUTUBE_API_KEY=your_youtube_data_api_key

# Vector DB (defaults shown; override for Qdrant Cloud)
QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=your_qdrant_cloud_key
QDRANT_COLLECTION=persona_knowledge
RESOURCES_COLLECTION=persona_resources

# Optional overrides
# GEMINI_MODEL=gemini-2.5-flash
# EMBEDDING_MODEL=gemini-embedding-001
# EMBEDDING_DIMENSIONS=768
# EMBEDDING_BATCH_SIZE=64
# EMBEDDING_REQUESTS_PER_MINUTE=90
```

See the full variable reference in [`docs/context-management.md`](docs/context-management.md#environment-variables).

### 3. Start Qdrant (local)

```bash
docker run -d --name persona-qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

Or point `QDRANT_URL` / `QDRANT_API_KEY` at a Qdrant Cloud cluster.

### 4. Populate the vector database

The repository ships the derived catalog on disk (`storage/chunks`,
`storage/resources`). To index it into Qdrant, run the embedding + resources
stages for both personas:

```bash
pnpm persona embed hitesh
pnpm persona embed piyush
pnpm persona resources hitesh
pnpm persona resources piyush
```

> The pipeline automatically creates the required Qdrant **payload indexes**
> (`persona`, and `type` on resources). Qdrant filtering fails without them.

### 5. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), pick a persona, and chat.

## The ETL pipeline

All ETL is driven by one CLI:

```bash
pnpm persona <command> <personaId> [--force] [--build-only]
```

- `<command>`: `collect | process | summarize | chunk | embed | resources | build`
- `<personaId>`: `hitesh | piyush`
- `--force`: reprocess/re-embed instead of skipping existing outputs
- `--build-only`: (resources only) write the catalog to disk **without** embedding
  (no API cost)

Run the full pipeline end-to-end:

```bash
pnpm persona build hitesh
```

Stage order and responsibilities are documented in
[`docs/data-pipeline.md`](docs/data-pipeline.md). Storage layout:

```
storage/
  raw/<persona>/youtube/     # collected transcripts + metadata (gitignored)
  processed/<persona>/        # cleaned + classified (gitignored)
  knowledge/<persona>/        # structured markdown/JSON (gitignored)
  chunks/<persona>/           # retrieval chunks
  resources/<persona>/        # resource catalog (videos + curated courses)
  embeddings/<persona>/       # run manifests (gitignored)
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck:scripts` | Type-check the ETL scripts |
| `pnpm persona ...` | Run the ETL pipeline (see above) |

## Persona voice content

Each persona's identity/voice text lives in `src/data/<persona>/`:
`bio.md`, `teaching-style.md`, `vocabulary.md`, `philosophy.md`. These are read
at runtime and injected into the system prompt. Fill them with real,
distinctive voice notes to maximize persona fidelity — the prompt builder drops
any section still containing `[PLACEHOLDER...]`.

## Deployment notes

The **runtime** app needs only:

1. A reachable, populated **Qdrant** instance (`QDRANT_URL` / `QDRANT_API_KEY`)
2. `GOOGLE_GENERATIVE_AI_API_KEY` (+ optional model overrides)
3. The `src/data/**` persona content (bundled with the app)

It does **not** need `storage/`. The ETL stages are run offline / in CI to
populate Qdrant, then the app is deployed against that Qdrant. Embeddings live
only in Qdrant — to move between instances, migrate via a Qdrant snapshot rather
than re-embedding.
