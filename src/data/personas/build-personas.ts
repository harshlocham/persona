import "server-only";

import { loadPersonaContent } from "@/data/load-persona-content";
import {
  PERSONA_DEFINITIONS,
  type PersonaDefinitionBase,
} from "@/data/personas/definitions";
import {
  PERSONA_CONTENT_FILE_MAP,
  PERSONA_CONTENT_SECTION_TITLES,
  type PersonaContentKey,
} from "@/data/types";
import type { Persona, PersonaPromptSection } from "@/domain/models/persona";

const CONTENT_KEYS: readonly PersonaContentKey[] = [
  "bio",
  "teaching-style",
  "vocabulary",
  "philosophy",
];

function buildPromptSections(
  slug: PersonaDefinitionBase["metadata"]["slug"],
): PersonaPromptSection[] {
  const content = loadPersonaContent(slug);

  return CONTENT_KEYS.map((key) => ({
    key,
    title: PERSONA_CONTENT_SECTION_TITLES[key],
    content: content[PERSONA_CONTENT_FILE_MAP[key]],
  }));
}

function buildPersona(definition: PersonaDefinitionBase): Persona {
  const { roleStatement, ...personaBase } = definition;

  return {
    ...personaBase,
    promptProfile: {
      roleStatement,
      sections: buildPromptSections(definition.metadata.slug),
    },
  };
}

let cachedPersonas: readonly Persona[] | undefined;

/**
 * Builds full persona entities with prompt profiles from markdown content.
 */
export function buildPersonas(): readonly Persona[] {
  if (!cachedPersonas) {
    cachedPersonas = PERSONA_DEFINITIONS.map(buildPersona);
  }

  return cachedPersonas;
}

export function getBuiltPersonaById(id: Persona["id"]): Persona | undefined {
  return buildPersonas().find((persona) => persona.id === id);
}
