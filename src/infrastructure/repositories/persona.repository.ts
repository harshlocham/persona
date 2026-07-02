import type { PersonaRepository } from "@/application/ports";
import type { Persona } from "@/domain/models/persona";
import {
  buildPersonas,
  getBuiltPersonaById,
} from "@/data/personas/build-personas";

/**
 * In-memory persona repository backed by persona definitions and markdown content.
 */
export const personaRepository: PersonaRepository = {
  getAll(): readonly Persona[] {
    return buildPersonas();
  },

  getById(id: Persona["id"]) {
    return getBuiltPersonaById(id);
  },
};
