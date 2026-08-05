import { describe, expect, it } from "vitest";

import {
  DefinitionMarkupError,
  getMarkedDefinitionText,
  normalizeAcronym,
  normalizeDefinition,
  parseDefinitionMarkup,
  validateDefinitionRanges,
} from "./acronym";

describe("acronym normalization", () => {
  it("trims and uppercases acronyms", () => {
    expect(normalizeAcronym("  api ")).toBe("API");
  });

  it("normalizes definition whitespace and casing", () => {
    expect(normalizeDefinition("  Application   Programming Interface ")).toBe(
      "application programming interface",
    );
  });

  it("removes optional range notation and records the plain-text ranges", () => {
    expect(
      parseDefinitionMarkup("[Ra]dio [D]etection [A]nd [R]anging"),
    ).toEqual({
      text: "Radio Detection And Ranging",
      ranges: [
        { start: 0, end: 2 },
        { start: 6, end: 7 },
        { start: 16, end: 17 },
        { start: 20, end: 21 },
      ],
    });
  });

  it("treats marked and unmarked definitions as the same normalized value", () => {
    expect(normalizeDefinition("[A]pplication [P]rogramming [I]nterface")).toBe(
      normalizeDefinition("Application Programming Interface"),
    );
  });

  it("validates that marked ranges spell the acronym", () => {
    const parsed = parseDefinitionMarkup("[Ra]dio [D]etection [A]nd [R]anging");

    expect(getMarkedDefinitionText(parsed)).toBe("RaDAR");
    expect(validateDefinitionRanges("RADAR", parsed)).toBeNull();
    expect(validateDefinitionRanges("RDR", parsed)).toContain(
      "must spell the acronym",
    );
    expect(
      validateDefinitionRanges(
        "RADAR",
        parseDefinitionMarkup("Radio Detection And Ranging"),
      ),
    ).toBeNull();
  });

  it.each([
    "Application [Programming Interface",
    "Application Programming] Interface",
    "Application [] Interface",
    "Application [[P]]rogramming Interface",
  ])("rejects malformed range notation: %s", (value) => {
    expect(() => parseDefinitionMarkup(value)).toThrow(DefinitionMarkupError);
  });
});
