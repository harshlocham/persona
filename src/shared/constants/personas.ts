export {
  DEFAULT_PERSONA_ID,
  PERSONA_IDS,
  PERSONA_UI_OPTIONS,
  getPersonaUiOptionById,
  isSupportedPersonaId,
  type SupportedPersonaId,
} from "@/data/personas";

export type { PersonaUiOption as PersonaOption } from "@/domain/models/persona";

/** Alias for {@link PERSONA_UI_OPTIONS} used by presentation components. */
export { PERSONA_UI_OPTIONS as PERSONA_OPTIONS } from "@/data/personas";
