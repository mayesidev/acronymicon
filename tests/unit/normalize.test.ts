import { describe, expect, it } from "vitest";

import { normalizeAcronym, normalizeDefinition } from "../../app/db/normalize";

describe("acronym normalization", () => {
  it("trims and uppercases acronyms", () => {
    expect(normalizeAcronym("  api ")).toBe("API");
  });

  it("normalizes definition whitespace and casing", () => {
    expect(normalizeDefinition("  Application   Programming Interface ")).toBe(
      "application programming interface",
    );
  });
});
