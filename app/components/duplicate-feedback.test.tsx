// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DuplicateFeedback } from "./duplicate-feedback";

const exactDuplicate = {
  id: "entry-1",
  definition: "Application Programming Interface",
};

const otherDefinition = {
  id: "entry-2",
  definition: "Annual Performance Index",
};

describe("duplicate feedback", () => {
  it("reserves no space when there is no duplicate feedback", () => {
    const { container } = render(
      <DuplicateFeedback
        acronym="API"
        exactDuplicate={null}
        existingEntries={[]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows all existing definitions for a new variant warning", () => {
    render(
      <DuplicateFeedback
        acronym="API"
        exactDuplicate={null}
        existingEntries={[exactDuplicate, otherDefinition]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      exactDuplicate.definition,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      otherDefinition.definition,
    );
  });

  it("shows only the identical definition for an exact duplicate", () => {
    render(
      <DuplicateFeedback
        acronym="API"
        exactDuplicate={exactDuplicate}
        existingEntries={[exactDuplicate, otherDefinition]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      exactDuplicate.definition,
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      otherDefinition.definition,
    );
  });
});
