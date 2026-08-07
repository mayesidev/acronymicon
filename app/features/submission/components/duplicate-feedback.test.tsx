// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
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

    const trigger = screen.getByRole("button", { name: "See warning" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute(
      "open",
    );

    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toHaveTextContent(
      exactDuplicate.definition,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      otherDefinition.definition,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(trigger).toHaveFocus();
  });

  it("shows only the identical definition for an exact duplicate", () => {
    render(
      <DuplicateFeedback
        acronym="API"
        exactDuplicate={exactDuplicate}
        existingEntries={[exactDuplicate, otherDefinition]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "See warning" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      exactDuplicate.definition,
    );
    expect(screen.getByRole("dialog")).not.toHaveTextContent(
      otherDefinition.definition,
    );
  });
});
