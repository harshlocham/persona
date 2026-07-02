import type { PersonaRepository } from "@/application/ports";
import type { Persona } from "@/domain/models/persona";
import {
  SUPPORTED_PERSONAS,
  getPersonaById,
} from "@/shared/constants/personas";

/**
 * In-memory persona repository backed by static persona constants.
 */
export const personaRepository: PersonaRepository = {
  getAll(): readonly Persona[] {
    return SUPPORTED_PERSONAS;
  },

  getById(id: Persona["id"]) {
    return getPersonaById(id);
  },
};
