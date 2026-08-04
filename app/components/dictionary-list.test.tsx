// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DefinitionText,
  DictionaryList,
} from "./dictionary-list";

const loaderData = {
  entries: [
    {
      id: "entry-1",
      acronym: "API",
      variant: 1,
      definition: "Application Programming Interface",
      definitionRanges: [],
      notes: "A contract between systems.",
      aliases: [],
      submittedByUsername: "local-user",
      submittedByDisplayName: "Local User",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  query: "",
  user: null,
};

describe("home dictionary view", () => {
  it("renders an entry with user-visible reference details", () => {
    render(<DictionaryList entries={loaderData.entries} />);

    expect(screen.getByText("API")).toBeInTheDocument();
    expect(
      screen.getByText("Application Programming Interface"),
    ).toBeInTheDocument();
    expect(screen.getByText("Submitted by Local User")).toBeInTheDocument();
  });

  it("emphasizes marked definition ranges", () => {
    render(
      <DefinitionText
        definition="Radio Detection And Ranging"
        ranges={[
          { start: 0, end: 2 },
          { start: 6, end: 7 },
          { start: 16, end: 17 },
          { start: 20, end: 21 },
        ]}
      />,
    );

    expect(
      screen.getAllByText(/^(Ra|D|A|R)$/, { selector: "strong" }),
    ).toHaveLength(4);
  });
});
