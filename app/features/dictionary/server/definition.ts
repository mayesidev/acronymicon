import type { DictionaryEntry, DictionarySort } from "../model";
import type { DictionaryDefinitionRepository } from "./repository";
import { sortDictionaryEntries } from "./sort";

export type DictionaryDefinitionResult =
  | { status: "missing-acronym"; acronym: "" }
  | { status: "list"; acronym: string; entries: DictionaryEntry[] }
  | { status: "entry"; acronym: string; entry: DictionaryEntry }
  | {
      status: "not-found";
      acronym: string;
      variant: string | number;
    };

export function createDictionaryDefinitionService(
  repository: DictionaryDefinitionRepository,
) {
  async function lookupDefinition(input: {
    acronym: string;
    variant: string | null;
    sort?: DictionarySort;
  }): Promise<DictionaryDefinitionResult> {
    const acronym = input.acronym.trim();

    if (!acronym) {
      return { status: "missing-acronym", acronym: "" };
    }

    if (input.variant === null) {
      return {
        status: "list",
        acronym,
        entries: sortDictionaryEntries(
          await repository.findPublishedByAcronym(acronym),
          input.sort ?? "alphabetical",
        ),
      };
    }

    const variant = Number(input.variant);
    if (!Number.isSafeInteger(variant) || variant < 1) {
      return {
        status: "not-found",
        acronym,
        variant: input.variant,
      };
    }

    const entry = await repository.findPublishedByVariant(acronym, variant);
    return entry
      ? { status: "entry", acronym, entry }
      : { status: "not-found", acronym, variant };
  }

  return { lookupDefinition };
}
