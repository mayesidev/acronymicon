import { describe, expect, it } from "vitest";

import { validateSubmissionInput } from "./input";

describe("submission input validation", () => {
  it("parses and trims valid form values", () => {
    expect(
      validateSubmissionInput({
        acronym: "  API ",
        definition: "  Application Programming Interface ",
        notes: "  A note ",
        confirmDuplicate: "true",
      }),
    ).toEqual({
      status: "valid",
      values: {
        acronym: "API",
        definition: "Application Programming Interface",
        notes: "A note",
        confirmDuplicate: "true",
      },
    });
  });

  it("reports required fields and preserves editable form values", () => {
    const result = validateSubmissionInput({
      acronym: " ",
      definition: "",
      notes: 42,
    });

    expect(result).toMatchObject({
      status: "invalid",
      errors: {
        acronym: ["Acronym is required."],
        definition: ["Definition is required."],
      },
      values: { acronym: " ", definition: "", notes: "" },
    });
  });

  it("maps malformed definition markup to a field error", () => {
    const result = validateSubmissionInput({
      acronym: "API",
      definition: "[Application Programming Interface",
      notes: "",
    });

    expect(result).toMatchObject({
      status: "invalid",
      errors: { definition: ["Definition ranges must be closed."] },
    });
  });

  it("rejects marked ranges that do not spell the acronym", () => {
    expect(
      validateSubmissionInput({
        acronym: "API",
        definition: "[A]pplication [P]rogramming Interface",
      }),
    ).toMatchObject({
      status: "invalid",
      errors: {
        definition: [expect.stringContaining("must spell the acronym")],
      },
    });
  });
});
