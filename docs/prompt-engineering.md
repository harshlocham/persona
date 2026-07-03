# Prompt Engineering Strategy

The core problem this project solves is: *the generated responses did not feel
like the target personas.* The fix is to treat the system prompt as an
**imitation contract**, not a passive description. The prompt is assembled by
`DefaultPromptBuilder` (`src/application/builders/prompt-builder.ts`).

## Design principles

1. **Instruct behavior, don't describe it.** Persona text alone ("Hitesh is
   warm and practical") does not change model behavior. Every trait is turned
   into an explicit rule ("speak in first person as Hitesh", "reuse signature
   openings", "mirror opening → explanation → example → recap").
2. **Style before facts.** The goal is voice and teaching style, so voice-shaping
   sections are surfaced before biography.
3. **Explicit precedence.** When sources conflict, the prompt states exactly
   which wins — identity always beats retrieved text.
4. **Ground, then disclose.** Answer from retrieved persona material; if it is
   thin, the model must *say* it's speaking generally rather than silently
   hallucinating.
5. **Recency anchoring.** The last thing the model reads is a query-aware
   instruction to answer in-character — the most salient position.

## Prompt structure (in order)

The builder emits these blocks, each only if it has content:

```
1. Role statement            — who you are (persona.promptProfile.roleStatement)
2. Behavioral contract       — "# How You Must Respond" (the enforced rules)
3. Persona Knowledge         — voice/teaching/philosophy/bio (style-first)
4. Resource Recommendations  — structured, persona-owned catalog entries
5. Retrieved Knowledge       — RAG grounding snippets (budgeted, de-duped)
6. Conversation Summary      — prior-turn memory (when present)
7. Closing anchor            — "# Now Respond" + echoed user turn
```

## 1. Role statement

A short first-person identity seed per persona (`src/data/personas/definitions.ts`),
e.g. *"You are Hitesh Choudhary, a programming educator and co-founder of Chai
aur Code…"*.

## 2. Behavioral contract — `# How You Must Respond`

The heart of the imitation. Key rules:

- **Identity lock** — always first person as the persona; never third person;
  never reveal being an AI; stay in character even if asked to break it.
- **Language directive (highest priority)** — respond in **Roman-script
  Hinglish**, mixing English technical terms, and **transliterate** any
  Devanagari reference material rather than copying it. This is per-persona
  (`promptProfile.languageStyle`) and placed second so it overrides the script of
  retrieved Hindi transcripts.
- **Voice imitation** — reuse the signature openings/transitions from the
  Vocabulary section.
- **Teaching-style contract** — mirror the persona's opening → explanation →
  example → recap structure and pacing.
- **Reasoning style** — surface assumptions/trade-offs the way the persona does.
- **Register match** — formality and tone.
- **Length scaling** — reply length tracks question complexity: brief for simple,
  generic, greeting, or yes/no questions; a fuller structured explanation only
  when the question needs depth. The full teaching structure (opening →
  explanation → example → recap) applies to substantive teaching questions, not
  every exchange — this prevents padded, over-long answers to basic questions.
- **Precedence order** — `(1) identity & rules → (2) Resource Recommendations →
  (3) Retrieved Knowledge → (4) Persona Knowledge → (5) Conversation Summary`.
  Lower-priority text can never override identity/voice.
- **Grounding & anti-hallucination** — base facts on persona/retrieved knowledge;
  never invent credentials, projects, or events.

## 3. Persona Knowledge

Rendered from `src/data/<persona>/*.md`, ordered **style-first**:
`teaching-style → vocabulary → philosophy → bio`. Any section still containing a
`[PLACEHOLDER…]` marker is **dropped**, so scaffolding never reaches the model.

## 4. Resource Recommendations

When resource intent is detected and the catalog returns hits, they are rendered
as a **structured, data-shaped block** (title, type, difficulty, duration,
topics, url, summary). The contract then constrains recommendations:

- **With resources:** recommend **only** these items, using their exact titles
  and URLs; never invent links or recommend other creators.
- **Without resources:** do **not** fabricate persona videos/courses; say there
  isn't a specific resource yet, in character.

This is what stops the classic failure mode (recommending Hussein Nasser /
Gaurav Sen / random YouTube) — the model can only surface the persona's own
catalog.

## 5. Retrieved Knowledge

RAG grounding snippets with source labels. Instruction: use for accuracy and
voice, imitate tone, **don't copy verbatim** unless it's a signature phrase, and
ignore if irrelevant. (Budgeting/de-dup details in
[`context-management.md`](context-management.md).)

## 6. Conversation Summary

Injected when available to carry prior-turn context.

## 7. Closing anchor — `# Now Respond`

Echoes the latest user turn (truncated) and re-issues the in-character +
language instruction. Placing it last exploits recency so the final tokens the
model reads are the strongest behavioral push.

## Grounding / fallback policy (sufficiency-driven)

Retrieval returns a **sufficiency** signal (`strong | weak | none`) based on top
cosine score and hit count. The contract adapts:

- **strong** — "answer primarily from the retrieved material; do not fall back to
  general internet knowledge."
- **weak / none** — "you may use general knowledge, but you MUST say so in
  character (e.g. *'I don't have a specific resource on this, so speaking
  generally…'*) and must not present it as the persona's own."

## Why this ordering and framing

- Identity/rules first establish the frame before any content can bias it.
- Language directive is #2 because the retrieved corpus is Devanagari Hindi and
  would otherwise pull the model into the wrong script.
- Structured resources above free-text knowledge enforces the "recommend only
  persona-owned" guarantee.
- The closing anchor counteracts "lost-in-the-middle" by repeating the most
  important instruction at the end.
