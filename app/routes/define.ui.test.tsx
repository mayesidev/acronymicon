// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { expect, it } from "vitest";

import Define from "./define";

const entry = {
  id: "opaque-entry-id",
  acronym: "API",
  variant: 1,
  definition: "Application Programming Interface",
  definitionRanges: [],
  notes: null,
  aliases: [],
  submittedByUsername: null,
  submittedByDisplayName: null,
  createdAt: "2026-08-13T00:00:00.000Z",
};

it("offers a native definition-sort submission with the visible value", async () => {
  const Routes = createRoutesStub([
    {
      path: "/define/:entryId",
      Component: Define,
      loader: () => ({
        status: "list" as const,
        acronym: "API",
        entries: [entry],
        sort: "alphabetical" as const,
      }),
    },
  ]);

  render(<Routes initialEntries={["/define/opaque-entry-id?view=all"]} />);
  const sort = await screen.findByLabelText("Sort definitions");
  const button = screen.getByRole("button", { name: "Apply sort" });
  const form = button.closest("form");
  if (!form || !(sort instanceof HTMLSelectElement)) {
    throw new TypeError("Expected a definition-sort form and select.");
  }

  sort.value = "recent";
  expect(Object.fromEntries(new FormData(form))).toEqual({
    view: "all",
    sort: "recent",
  });
  expect(form).toHaveAttribute("method", "get");
  expect(button).toHaveAttribute("type", "submit");
});
