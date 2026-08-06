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

  it("lists all definitions when no variant is requested", async () => {
    const { repository, service } = setup({ entries: [entry] });

    await expect(
      service.lookupDefinition({ acronym: " api ", variant: null }),
    ).resolves.toEqual({ status: "list", acronym: "api", entries: [entry] });
    expect(repository.findPublishedByAcronym).toHaveBeenCalledWith("api");
    expect(repository.findPublishedByVariant).not.toHaveBeenCalled();
  });

  it("returns the requested definition variant", async () => {
    const { repository, service } = setup({ entry });

    await expect(
      service.lookupDefinition({ acronym: "api", variant: "2" }),
    ).resolves.toEqual({ status: "entry", acronym: "api", entry });
    expect(repository.findPublishedByVariant).toHaveBeenCalledWith("api", 2);
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
  options: { entries?: DictionaryEntry[]; entry?: DictionaryEntry } = {},
) {
  const repository = {
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
