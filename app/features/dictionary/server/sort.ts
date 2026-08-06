import { normalizeAcronym } from "../../../domain/acronym";
import type { DictionaryEntry, DictionarySort } from "../model";

export function sortDictionaryEntries(
  entries: DictionaryEntry[],
  sort: DictionarySort,
) {
  return [...entries].sort((left, right) =>
    compareDictionaryEntries(left, right, sort),
  );
}

export function compareDictionaryEntries(
  left: DictionaryEntry,
  right: DictionaryEntry,
  sort: DictionarySort,
) {
  if (sort === "recent" && left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return (
    compareText(
      normalizeAcronym(left.acronym),
      normalizeAcronym(right.acronym),
    ) ||
    compareText(left.definition, right.definition) ||
    left.variant - right.variant ||
    left.id.localeCompare(right.id)
  );
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}
