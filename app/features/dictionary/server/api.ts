import type { DictionarySort } from "../model";
import { createAcronymRepository } from "../../../platform/database/acronym-repository.server";
import { getAppDatabase } from "../../../platform/database/lifecycle.server";
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

export function lookupDefinition(input: {
  acronym: string;
  variant: string | null;
}) {
  return createDictionaryDefinitionService(getRepository()).lookupDefinition(
    input,
  );
}

function getRepository() {
  return createAcronymRepository(getAppDatabase());
}
