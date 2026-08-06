// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DefinitionText,
  DictionaryList,
  formatSubmittedDate,
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

describe("dictionary list", () => {
  it("renders an entry with user-visible reference details", () => {
    render(<DictionaryList entries={loaderData.entries} />);

    expect(screen.getByText("API")).toBeInTheDocument();
    expect(
      screen.getByText("Application Programming Interface"),
    ).toBeInTheDocument();
    expect(screen.getByText("Submitted Jan 1, 2026")).toBeInTheDocument();
  });

  it("underlines marked definition ranges", () => {
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
      screen.getAllByText(/^(Ra|D|A|R)$/, { selector: "u" }),
    ).toHaveLength(4);
  });

  it("does not add emphasis when no ranges are defined", () => {
    render(
      <DefinitionText
        definition="Application Programming Interface"
        ranges={[]}
      />,
    );

    expect(
      screen.queryByText("Application Programming Interface", { selector: "u" }),
    ).not.toBeInTheDocument();
  });

  it("groups alphabetically browsed entries by initial", () => {
    render(
      <DictionaryList
        entries={[
          { ...loaderData.entries[0], acronym: "API" },
          { ...loaderData.entries[0], id: "entry-2", acronym: "RADAR" },
          { ...loaderData.entries[0], id: "entry-3", acronym: "42" },
        ]}
        groupByLetter
      />,
    );

    expect(screen.getByRole("heading", { name: "#" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "R" })).toBeInTheDocument();
  });

  it("formats stored UTC timestamps for users", () => {
    expect(formatSubmittedDate("2026-01-01 00:00:00")).toBe("Jan 1, 2026");
  });
});
