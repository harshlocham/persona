import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { PersonaContentBundle } from "@/data/types";
import type { PersonaSlug } from "@/domain/models/persona";

const CONTENT_ROOT = path.join(process.cwd(), "src/data");

function readMarkdown(slug: PersonaSlug, filename: string): string {
  const filePath = path.join(CONTENT_ROOT, slug, filename);

  return fs.readFileSync(filePath, "utf-8").trim();
}

/**
 * Loads placeholder persona markdown content from `src/data/{slug}/`.
 * Server-only — used when assembling full persona prompt profiles.
 */
export function loadPersonaContent(slug: PersonaSlug): PersonaContentBundle {
  return {
    bio: readMarkdown(slug, "bio.md"),
    teachingStyle: readMarkdown(slug, "teaching-style.md"),
    vocabulary: readMarkdown(slug, "vocabulary.md"),
    philosophy: readMarkdown(slug, "philosophy.md"),
  };
}
