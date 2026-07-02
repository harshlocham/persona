/**
 * Branded type for persona identifiers.
 * Prevents accidental mixing of arbitrary strings with valid persona IDs.
 */
export type PersonaId = string & { readonly __brand: "PersonaId" };

export function toPersonaId(id: string): PersonaId {
  return id as PersonaId;
}

/** Supported persona slugs used for content paths and lookup. */
export type PersonaSlug = "hitesh" | "piyush";

/**
 * Avatar metadata for UI rendering.
 */
export interface PersonaAvatarMetadata {
  readonly initials: string;
  readonly imageUrl?: string;
}

/**
 * Persona-specific accent colors applied in the chat UI.
 */
export interface PersonaAccentColors {
  readonly primary: string;
  readonly primaryForeground: string;
  readonly bubble: string;
  readonly bubbleForeground: string;
  readonly muted: string;
}

/**
 * Client-facing persona metadata for selectors, empty states, and theming.
 */
export interface PersonaMetadata {
  readonly slug: PersonaSlug;
  readonly displayTitle: string;
  readonly suggestedQuestions: readonly string[];
  readonly avatar: PersonaAvatarMetadata;
  readonly accent: PersonaAccentColors;
}

/**
 * A structured section injected into the system prompt.
 */
export interface PersonaPromptSection {
  readonly key: "bio" | "teaching-style" | "vocabulary" | "philosophy";
  readonly title: string;
  readonly content: string;
}

/**
 * Structured prompt profile assembled from persona content and metadata.
 */
export interface PersonaPromptProfile {
  readonly roleStatement: string;
  /**
   * Explicit language/script directive for responses (e.g. Hinglish in Roman
   * script). Enforced in the behavioral contract so the model does not mirror
   * the script of retrieved reference material.
   */
  readonly languageStyle: string;
  readonly sections: readonly PersonaPromptSection[];
}

/**
 * Core persona entity — defines an AI character's identity and behavior.
 */
export interface Persona {
  readonly id: PersonaId;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly metadata: PersonaMetadata;
  readonly promptProfile: PersonaPromptProfile;
}

/**
 * Client-safe persona option without prompt content.
 */
export type PersonaUiOption = Pick<
  Persona,
  "id" | "name" | "description" | "tags" | "metadata"
>;
