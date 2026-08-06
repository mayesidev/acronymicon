import type { DefinitionRange } from "../../domain/acronym";

export type DictionaryEntry = {
  id: string;
  acronym: string;
  variant: number;
  definition: string;
  definitionRanges: DefinitionRange[];
  notes: string | null;
  aliases: string[];
  submittedByUsername: string | null;
  submittedByDisplayName: string | null;
  createdAt: string;
};

export type DictionarySort = "alphabetical" | "recent";

export const dictionarySortOptions = [
  { label: "Alphabetical", value: "alphabetical" },
  { label: "Most recent", value: "recent" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: DictionarySort;
}>;
