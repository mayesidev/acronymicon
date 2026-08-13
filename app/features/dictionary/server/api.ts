import type { DictionarySort } from "../model";
import { createAcronymRepository } from "../../../platform/database/acronym-repository.server";
import { getAppDatabase } from "../../../platform/database/lifecycle.server";
import { getAppConfig } from "../../../platform/config/runtime.server";
import { createDictionaryDefinitionService } from "./definition";
import { createDictionaryReadService } from "./read";

export function listPublishedAcronyms(
  searchTerm: string,
  sort: DictionarySort,
) {
  return createDictionaryReadService(getRepository()).listPublishedAcronyms(
    searchTerm,
    sort,
  );
}

export async function loadDictionarySearch(
  query: string,
  sort: DictionarySort,
) {
  return {
    entries: await listPublishedAcronyms(query, sort),
    query,
    sort,
  };
}

export function usesControlledDictionarySearch() {
  return getAppConfig().deployment.profile === "controlled";
}

export function lookupDefinition(input: {
  acronym: string;
  variant: string | null;
  sort?: DictionarySort;
}) {
  return createDictionaryDefinitionService(getRepository()).lookupDefinition(
    input,
  );
}

function getRepository() {
  return createAcronymRepository(getAppDatabase());
}
