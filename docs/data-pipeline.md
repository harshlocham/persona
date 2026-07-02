# Data Pipeline — Collection & Preparation

How the raw content of each educator becomes clean, retrievable, persona-scoped
knowledge and a structured resource catalog in Qdrant.

The pipeline is a six-stage ETL driven by a single CLI:

```bash
pnpm persona <collect|process|summarize|chunk|embed|resources|build> <persona> [--force] [--build-only]
```

Every stage reads the previous stage's output from `storage/` and writes its own.
Only `embed` and (the embedding half of) `resources` call an external API
(Gemini); everything else is pure and free to re-run.

```
collect ─► process ─► summarize ─► chunk ─► embed ──► Qdrant: persona_knowledge
                                                 
(curated courses) + collect ─────────► resources ──► Qdrant: persona_resources
```

## Source configuration

Sources per persona are declared in `scripts/config/personas.ts`:

| Persona | YouTube channel | Playlist | Website |
|---|---|---|---|
| `hitesh` | `@chaiaurcode` | curated playlist | `hitesh.ai` |
| `piyush` | `@piyushgargdev` | curated playlist | `piyushgarg.dev` |

## Stage 1 — `collect`

**Input:** YouTube channel/playlist handles · **Output:** `storage/raw/<persona>/youtube/*.json`

- Uses the **YouTube Data API v3** (`YOUTUBE_API_KEY`) to discover every video in
  the configured channels/playlists (`discovery.ts`).
- Fetches each video's **transcript** (`youtube-transcript`) and metadata
  (title, description, duration, publish date).
- Writes one raw JSON document per video plus an `index.json`. Requests are
  throttled (250 ms between videos) and existing files are skipped unless
  `--force`.
- Videos without a transcript are still recorded (counted as
  `withoutTranscript`) so they can appear in the resource catalog.

## Stage 2 — `process`

**Input:** raw documents · **Output:** `storage/processed/<persona>/*.json`

Three sub-steps (`cleaner.ts`, `normalize.ts`, `classifier.ts`):

1. **Clean** — strip sponsor/promo lines, intros/outros, and timestamps via
   regex heuristics.
2. **Normalize** — Unicode `NFKC`, collapse whitespace, and preserve fenced /
   inline code blocks.
3. **Classify** — attach:
   - **topic** — one of `bio | teaching-style | vocabulary | philosophy | general`
     (keyword heuristics; most tutorial content is `general`).
   - **keywords** — token-frequency terms. Cleaned to drop pure-numeric and
     numeric-heavy tokens (port numbers, prices) that ASR transcripts produce.
   - **language** — `hi | hi-en | en | unknown` via Devanagari/Latin ratio.
   - **summary** — a short lead summary.

## Stage 3 — `summarize` (knowledge)

**Input:** processed documents · **Output:** `storage/knowledge/<persona>/`

Builds a **structured knowledge document** (`knowledge/builder.ts` +
`templates.ts`) by classifying each sentence into sections using bilingual
(English + Hindi) pattern matching:

- `Main Concepts`, `Practical Advice`, `Teaching Pattern`, `Important Vocabulary`,
  `Examples`, `Common Mistakes`, `Key Takeaways`.

Each section is de-duplicated and capped. Empty sections render a
`_No content extracted._` placeholder (later dropped during chunking).

## Stage 4 — `chunk`

**Input:** knowledge documents · **Output:** `storage/chunks/<persona>/<topic>/*.json`

- Splits knowledge markdown **by heading**, then splits any long section into
  **overlapping windows** (max 700 words, 100-word overlap) so no chunk exceeds
  the embedding-friendly size.
- **Quality gate** (`chunk/builder.ts`) drops low-value chunks that would
  pollute retrieval:
  - the `Important Vocabulary` section (a keyword dump, not prose),
  - chunks under 12 words,
  - bullet-list dumps (≥60% short list items).
- Each chunk carries persona, topic, section, source attribution, a content
  hash, and language.

## Stage 5 — `embed`

**Input:** chunks · **Output:** vectors in Qdrant `persona_knowledge` + a run manifest

- Embeds chunk text with **`gemini-embedding-001`**, `768` dimensions, task type
  **`RETRIEVAL_DOCUMENT`**.
- Batches (default 64), paced to a configurable requests-per-minute, with
  **exponential-backoff retry** so a transient 429 / network blip never discards
  a whole (paid) batch.
- Upserts into Qdrant with a deterministic UUID point ID derived from the chunk
  ID (idempotent re-runs). Existing points are skipped unless `--force`.
- Ensures a **keyword payload index on `persona`** (required for filtered search
  on Qdrant Cloud).
- Distance metric: **Cosine**.

## Stage 6 — `resources`

**Input:** raw YouTube docs + curated courses · **Output:** `storage/resources/<persona>/` and Qdrant `persona_resources`

Builds a **structured resource catalog** so recommendations are real
persona-owned items instead of model guesses:

- **Videos** — derived from raw YouTube metadata (`resources/builder.ts`):
  - `topics` via **word-boundary** regex (avoids false positives like
    "chai" → ai, "interact" → react),
  - `difficulty` (beginner/intermediate/advanced) from title/description hints,
  - a link-free `summary`, `durationMinutes`, `url`, `publishedAt`.
- **Courses** — curated, first-class entries (`resources/courses.ts`) with exact
  titles/URLs for chaicode.com, piyushgarg.dev, and hitesh.ai/udemy-* courses.
- Embeds `title + summary + topics + difficulty` into `persona_resources` and
  ensures payload indexes on **`persona`** and **`type`**.
- `--build-only` regenerates the on-disk catalog without embedding (no API cost).

The `ResourceRecord` schema (fields relevant at retrieval time):

```
title, type (video|playlist|course|blog), url, topics[], difficulty,
durationMinutes?, summary, personaId
```

## Data quality characteristics

Worth knowing when reasoning about answer quality:

- The source corpus is **~99% Hindi** (the educators teach in Hindi/Hinglish),
  and YouTube auto-captions introduce ASR noise (e.g. `manguz` → mongoose).
  Retrieval is therefore cross-lingual (English query vs. Hindi documents);
  the runtime prompt instructs the model to answer in **Roman-script Hinglish**
  and transliterate any Devanagari reference material.
- After the quality pass, indexed chunk counts are ~3,922 (hitesh) and ~3,007
  (piyush); resource catalog is 869 (hitesh) and 637 (piyush), including 8 and 4
  curated courses respectively.
- The biggest remaining lever is transliteration/translation of transcripts at
  the `process` stage (an LLM pass), which would improve cross-lingual retrieval
  recall and keyword quality.

## Re-running / migrating

- Re-run any pure stage freely with `--force`. Re-running `chunk` changes the
  chunk set, so re-run `embed --force` afterward to keep Qdrant consistent.
- Embeddings live **only in Qdrant**. To move between Qdrant instances, use a
  **Qdrant snapshot** (no re-embedding, no API cost) rather than re-running
  `embed`.
