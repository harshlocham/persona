export type PersonaContentKey =
  | "bio"
  | "teaching-style"
  | "vocabulary"
  | "philosophy";

export interface PersonaContentBundle {
  readonly bio: string;
  readonly teachingStyle: string;
  readonly vocabulary: string;
  readonly philosophy: string;
}

export const PERSONA_CONTENT_FILE_MAP: Record<
  PersonaContentKey,
  keyof PersonaContentBundle
> = {
  bio: "bio",
  "teaching-style": "teachingStyle",
  vocabulary: "vocabulary",
  philosophy: "philosophy",
};

export const PERSONA_CONTENT_SECTION_TITLES: Record<PersonaContentKey, string> =
  {
    bio: "Bio",
    "teaching-style": "Teaching Style",
    vocabulary: "Vocabulary",
    philosophy: "Philosophy",
  };
