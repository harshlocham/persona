import { Sparkles } from "lucide-react";

import { PersonaSwitcher } from "@/presentation/components/chat/persona-switcher";
import type { PersonaOption } from "@/shared/constants/personas";
import type { PersonaId } from "@/domain/models/persona";

interface HeaderProps {
  personas: readonly PersonaOption[];
  personaId: PersonaId;
  onPersonaChange: (personaId: PersonaId) => void;
  isBusy?: boolean;
}

export function Header({
  personas,
  personaId,
  onPersonaChange,
  isBusy = false,
}: HeaderProps) {
  return (
    <header className="border-b bg-background/80 px-4 py-4 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Persona</h1>
            <p className="text-sm text-muted-foreground">
              AI personas for focused conversations
            </p>
          </div>
        </div>

        <PersonaSwitcher
          personas={personas}
          value={personaId}
          onChange={onPersonaChange}
          disabled={isBusy}
        />
      </div>
    </header>
  );
}
