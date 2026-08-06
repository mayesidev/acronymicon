import type { DictionaryEntry } from "../model";

export type DictionaryListRepository = {
  listPublishedEntries: () => Promise<DictionaryEntry[]>;
};

export type DictionaryDefinitionRepository = {
  findPublishedByAcronym: (acronym: string) => Promise<DictionaryEntry[]>;
  findPublishedByVariant: (
    acronym: string,
    variant: number,
  ) => Promise<DictionaryEntry | null>;
};

export type DictionaryRepository = DictionaryListRepository &
  DictionaryDefinitionRepository;
