/**
 * Branded type for persona identifiers.
 * Prevents accidental mixing of arbitrary strings with valid persona IDs.
 */
export type PersonaId = string & { readonly __brand: "PersonaId" };

export function toPersonaId(id: string): PersonaId {
  return id as PersonaId;
}

/**
 * Core persona entity — defines an AI character's identity and behavior.
 */
export interface Persona {
  readonly id: PersonaId;
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly avatarUrl?: string;
  readonly tags: readonly string[];
}
