import type { DictionaryEntry } from "../model";

export type DictionaryRepository = {
  listPublishedEntries: () => Promise<DictionaryEntry[]>;
};
