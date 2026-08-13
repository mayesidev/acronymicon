import { describe, expect, it, vi } from "vitest";

import type { DictionaryEntry } from "../model";
import { createDictionaryDefinitionService } from "./definition";

const entry = dictionaryEntry({ variant: 2 });

describe("dictionary definition service", () => {
  it("returns the missing-acronym state without querying the repository", async () => {
    const { repository, service } = setup();

    await expect(
      service.lookupDefinition({ acronym: "  ", variant: null }),
    ).resolves.toEqual({ status: "missing-acronym", acronym: "" });
    expect(repository.findPublishedByAcronym).not.toHaveBeenCalled();
    expect(repository.findPublishedByVariant).not.toHaveBeenCalled();
  });

  it("lists definitions alphabetically when no variant is requested", async () => {
    const annual = dictionaryEntry({
      id: "annual",
      definition: "Annual Performance Index",
      variant: 1,
    });
    const application = dictionaryEntry({
      id: "application",
      definition: "Application Programming Interface",
      variant: 2,
    });
    const { repository, service } = setup({ entries: [application, annual] });

    await expect(
      service.lookupDefinition({ acronym: " api ", variant: null }),
    ).resolves.toEqual({
      status: "list",
      acronym: "api",
      entries: [annual, application],
    });
    expect(repository.findPublishedByAcronym).toHaveBeenCalledWith("api");
    expect(repository.findPublishedByVariant).not.toHaveBeenCalled();
  });

  it("lists definitions by recency when requested", async () => {
    const older = dictionaryEntry({ id: "older", createdAt: "2026-08-01" });
    const newer = dictionaryEntry({ id: "newer", createdAt: "2026-08-06" });
    const { service } = setup({ entries: [older, newer] });

    await expect(
      service.lookupDefinition({
        acronym: "api",
        variant: null,
        sort: "recent",
      }),
    ).resolves.toMatchObject({ entries: [{ id: "newer" }, { id: "older" }] });
  });

  it("returns the requested definition variant", async () => {
    const { repository, service } = setup({ entry });

    await expect(
      service.lookupDefinition({ acronym: "api", variant: "2" }),
    ).resolves.toEqual({ status: "entry", acronym: "api", entry });
    expect(repository.findPublishedByVariant).toHaveBeenCalledWith("api", 2);
    expect(repository.findPublishedByAcronym).not.toHaveBeenCalled();
  });

  it("returns a published entry by opaque identifier", async () => {
    const { repository, service } = setup({ entryById: entry });

    await expect(
      service.lookupDefinitionById({
        entryId: "entry-id",
        related: false,
      }),
    ).resolves.toEqual({ status: "entry", acronym: "API", entry });
    expect(repository.findPublishedById).toHaveBeenCalledWith("entry-id");
    expect(repository.findPublishedByAcronym).not.toHaveBeenCalled();
  });

  it("uses an opaque entry as the anchor for related definitions", async () => {
    const annual = dictionaryEntry({ id: "annual", definition: "Annual" });
    const { repository, service } = setup({
      entryById: entry,
      entries: [entry, annual],
    });

    await expect(
      service.lookupDefinitionById({
        entryId: "entry-id",
        related: true,
        sort: "alphabetical",
      }),
    ).resolves.toMatchObject({
      status: "list",
      acronym: "API",
      entries: [{ id: "annual" }, { id: entry.id }],
    });
    expect(repository.findPublishedByAcronym).toHaveBeenCalledWith("API");
  });

  it("returns not found for an unknown opaque identifier", async () => {
    const { repository, service } = setup();

    await expect(
      service.lookupDefinitionById({ entryId: "unknown", related: false }),
    ).resolves.toEqual({ status: "not-found", entryId: "unknown" });
    expect(repository.findPublishedByAcronym).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-1", "1.5", "not-a-number"])(
    "rejects invalid variant %j without querying the repository",
    async (variant) => {
      const { repository, service } = setup();

      await expect(
        service.lookupDefinition({ acronym: "api", variant }),
      ).resolves.toEqual({ status: "not-found", acronym: "api", variant });
      expect(repository.findPublishedByAcronym).not.toHaveBeenCalled();
      expect(repository.findPublishedByVariant).not.toHaveBeenCalled();
    },
  );

  it("returns not found when a valid variant is unknown", async () => {
    const { repository, service } = setup();

    await expect(
      service.lookupDefinition({ acronym: "api", variant: "3" }),
    ).resolves.toEqual({ status: "not-found", acronym: "api", variant: 3 });
    expect(repository.findPublishedByVariant).toHaveBeenCalledWith("api", 3);
  });
});

function setup(
  options: {
    entries?: DictionaryEntry[];
    entry?: DictionaryEntry;
    entryById?: DictionaryEntry;
  } = {},
) {
  const repository = {
    findPublishedById: vi.fn(() =>
      Promise.resolve(options.entryById ?? null),
    ),
    findPublishedByAcronym: vi.fn(() => Promise.resolve(options.entries ?? [])),
    findPublishedByVariant: vi.fn(() => Promise.resolve(options.entry ?? null)),
  };

  return {
    repository,
    service: createDictionaryDefinitionService(repository),
  };
}

function dictionaryEntry(
  overrides: Partial<DictionaryEntry> = {},
): DictionaryEntry {
  return {
    id: "entry-id",
    acronym: "API",
    variant: 1,
    definition: "Application Programming Interface",
    definitionRanges: [],
    notes: null,
    aliases: [],
    submittedByUsername: null,
    submittedByDisplayName: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    ...overrides,
  };
}
