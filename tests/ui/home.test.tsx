// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DictionaryList } from "../../app/components/dictionary-list";

const loaderData = {
  entries: [
    {
      id: "entry-1",
      acronym: "API",
      definition: "Application Programming Interface",
      definitionRanges: [],
      notes: "A contract between systems.",
      category: "Technology",
      tags: ["software"],
      aliases: [],
      source: null,
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
    expect(screen.getByText("Application Programming Interface")).toBeInTheDocument();
    expect(screen.getByText("Submitted by Local User")).toBeInTheDocument();
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("software")).toBeInTheDocument();
  });
});
