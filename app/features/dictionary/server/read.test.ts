import { describe, expect, it, vi } from "vitest";

import type { DictionaryEntry } from "../model";
import type { DictionaryListRepository } from "./repository";
import { createDictionaryReadService } from "./read";

describe("dictionary list, search, and sort", () => {
  it("sorts unfiltered entries alphabetically by acronym and variant", async () => {
    const service = createService([
      entry({ id: "zulu", acronym: "ZULU" }),
      entry({ id: "api-2", acronym: "API", variant: 2 }),
      entry({ id: "api-1", acronym: "API" }),
    ]);

    await expect(
      service.listPublishedAcronyms("", "alphabetical"),
    ).resolves.toMatchObject([
      { id: "api-1" },
      { id: "api-2" },
      { id: "zulu" },
    ]);
  });

  it("sorts recent entries by date with stable acronym ordering for ties", async () => {
    const service = createService([
      entry({ id: "old", acronym: "OLD", createdAt: "2026-01-01" }),
      entry({ id: "zulu", acronym: "ZULU", createdAt: "2026-02-01" }),
      entry({ id: "alpha", acronym: "ALPHA", createdAt: "2026-02-01" }),
    ]);

    await expect(
      service.listPublishedAcronyms("", "recent"),
    ).resolves.toMatchObject([{ id: "alpha" }, { id: "zulu" }, { id: "old" }]);
  });

  it("ranks exact, prefix, substring, and fuzzy matches", async () => {
    const service = createService([
      entry({ id: "fuzzy", acronym: "APP" }),
      entry({
        id: "substring",
        acronym: "TOOL",
        definition: "Uses API internally",
      }),
      entry({ id: "prefix", acronym: "APIS" }),
      entry({ id: "exact", acronym: "API" }),
      entry({ id: "missing", acronym: "RADAR" }),
    ]);

    await expect(service.listPublishedAcronyms(" api ")).resolves.toMatchObject(
      [{ id: "exact" }, { id: "prefix" }, { id: "substring" }, { id: "fuzzy" }],
    );
  });

  it("matches minor typos in user-visible words", async () => {
    const service = createService([
      entry({ id: "app", acronym: "APP", definition: "Application Profile" }),
      entry({
        id: "api",
        acronym: "API",
        definition: "Application Programming Interface",
      }),
    ]);

    await expect(
      service.listPublishedAcronyms("applcation"),
    ).resolves.toMatchObject([{ id: "api" }, { id: "app" }]);
  });

  it("does not search notes or return nonmatches", async () => {
    const service = createService([
      entry({ id: "api", acronym: "API", notes: "Systems integration" }),
    ]);

    await expect(service.listPublishedAcronyms("integration")).resolves.toEqual(
      [],
    );
    await expect(service.listPublishedAcronyms("missing")).resolves.toEqual([]);
  });
});

function createService(entries: DictionaryEntry[]) {
  const repository: DictionaryListRepository = {
    listPublishedEntries: vi.fn(() => Promise.resolve(entries)),
  };
  return createDictionaryReadService(repository);
}

function entry(
  overrides: Partial<DictionaryEntry> & Pick<DictionaryEntry, "id" | "acronym">,
): DictionaryEntry {
  const { id, acronym, ...values } = overrides;
  return {
    id,
    acronym,
    variant: 1,
    definition: "Reference Definition",
    definitionRanges: [],
    notes: null,
    aliases: [],
    submittedByUsername: null,
    submittedByDisplayName: null,
    createdAt: "2026-01-01",
    ...values,
  };
}
