import { describe, expect, it } from "vitest";

import {
  evaluateDuplicatePolicy,
  exactDuplicateMessage,
  getDefinitionError,
} from "./policy";

const existingEntry = {
  id: "entry-1",
  definition: "Application Programming Interface",
};

describe("submission definition policy", () => {
  it("allows an unmarked definition while the user is still editing", () => {
    expect(getDefinitionError("API", "Application Programming Interface")).toBe(
      null,
    );
    expect(getDefinitionError("API", "  ")).toBeNull();
  });
});

describe("submission duplicate policy", () => {
  it("rejects an exact duplicate even when another meaning was confirmed", () => {
    expect(
      evaluateDuplicatePolicy(
        { confirmDuplicate: "true" },
        { exactDuplicate: existingEntry, existingEntries: [existingEntry] },
      ),
    ).toEqual({
      status: "exact-duplicate",
      duplicate: existingEntry,
      errors: { definition: [exactDuplicateMessage] },
    });
  });

  it("requires confirmation before adding another meaning", () => {
    expect(
      evaluateDuplicatePolicy(
        {},
        { exactDuplicate: null, existingEntries: [existingEntry] },
      ),
    ).toEqual({
      status: "duplicate-warning",
      existingEntries: [existingEntry],
    });
  });

  it("accepts a confirmed additional meaning", () => {
    expect(
      evaluateDuplicatePolicy(
        { confirmDuplicate: "true" },
        { exactDuplicate: null, existingEntries: [existingEntry] },
      ),
    ).toEqual({ status: "accepted" });
  });

  it("accepts a definition when the acronym has no matches", () => {
    expect(
      evaluateDuplicatePolicy(
        {},
        { exactDuplicate: null, existingEntries: [] },
      ),
    ).toEqual({ status: "accepted" });
  });
});
