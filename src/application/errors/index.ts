/**
 * Application-layer errors surfaced to API handlers and use cases.
 */
export class PersonaNotFoundError extends Error {
  readonly name = "PersonaNotFoundError";

  constructor(readonly personaId: string) {
    super(`Persona not found: ${personaId}`);
  }
}
