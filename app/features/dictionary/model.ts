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

export type DictionarySearchResult = {
  entries: DictionaryEntry[];
  query: string;
  sort: DictionarySort;
};

export const dictionarySortOptions = [
  { label: "Alphabetical", value: "alphabetical" },
  { label: "Most recent", value: "recent" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: DictionarySort;
}>;

export function parseDictionarySort(value: string | null): DictionarySort {
  return value === "recent" ? "recent" : "alphabetical";
}

export function buildDefinitionHref(
  entryId: string,
  options: { related?: boolean; sort?: DictionarySort } = {},
) {
  const path = `/define/${encodeURIComponent(entryId)}`;

  if (!options.related) {
    return path;
  }

  const parameters = new URLSearchParams({ view: "all" });
  if (options.sort === "recent") {
    parameters.set("sort", "recent");
  }

  return `${path}?${parameters.toString()}`;
}
