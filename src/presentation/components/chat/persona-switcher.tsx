"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PersonaUiOption } from "@/domain/models/persona";
import type { PersonaId } from "@/domain/models/persona";

interface PersonaSwitcherProps {
  personas: readonly PersonaUiOption[];
  value: PersonaId;
  onChange: (personaId: PersonaId) => void;
  disabled?: boolean;
}

export function PersonaSwitcher({
  personas,
  value,
  onChange,
  disabled = false,
}: PersonaSwitcherProps) {
  const selected = personas.find((persona) => persona.id === value);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as PersonaId)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-[260px]">
          <SelectValue placeholder="Select persona" />
        </SelectTrigger>
        <SelectContent>
          {personas.map((persona) => (
            <SelectItem key={persona.id} value={persona.id}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    backgroundColor: persona.metadata.accent.muted,
                    color: persona.metadata.accent.primary,
                  }}
                >
                  {persona.metadata.avatar.initials}
                </span>
                {persona.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected ? (
        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <p className="truncate text-sm text-muted-foreground">
            {selected.metadata.displayTitle}
          </p>
          {selected.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="shrink-0">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
