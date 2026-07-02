import type { CSSProperties } from "react";

import type { PersonaAccentColors } from "@/domain/models/persona";

/**
 * Maps persona accent colors to CSS custom properties for theming.
 */
export function getPersonaThemeStyle(
  accent: PersonaAccentColors,
): CSSProperties {
  return {
    "--persona-primary": accent.primary,
    "--persona-primary-foreground": accent.primaryForeground,
    "--persona-bubble": accent.bubble,
    "--persona-bubble-foreground": accent.bubbleForeground,
    "--persona-muted": accent.muted,
  } as CSSProperties;
}
