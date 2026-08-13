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

export type EntryDefinitionResult =
  | { status: "entry"; acronym: string; entry: DictionaryEntry }
  | { status: "list"; acronym: string; entries: DictionaryEntry[] }
  | { status: "not-found"; entryId: string };

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

  async function lookupDefinitionById(input: {
    entryId: string;
    related: boolean;
    sort?: DictionarySort;
  }): Promise<EntryDefinitionResult> {
    const entryId = input.entryId.trim();
    const entry = entryId
      ? await repository.findPublishedById(entryId)
      : null;

    if (!entry) {
      return { status: "not-found", entryId };
    }

    if (!input.related) {
      return { status: "entry", acronym: entry.acronym, entry };
    }

    return {
      status: "list",
      acronym: entry.acronym,
      entries: sortDictionaryEntries(
        await repository.findPublishedByAcronym(entry.acronym),
        input.sort ?? "alphabetical",
      ),
    };
  }

  return { lookupDefinition, lookupDefinitionById };
}
