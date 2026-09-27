// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, createRoutesStub, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import type { SubmissionActionData } from "../model";
import { exactDuplicateMessage } from "../policy";
import { SubmissionForm } from "./submission-form";

const existingEntry = {
  id: "existing-id",
  definition: "Application Programming Interface",
};

describe("submission form", () => {
  it("server-renders an enabled native submit and readable duplicate feedback", () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <SubmissionForm
            actionData={{
              status: "duplicate-warning",
              existingEntries: [existingEntry],
              values: { acronym: "API", definition: "New meaning" },
            }}
          />
        ),
      },
    ]);
    const view = renderToString(<RouterProvider router={router} />);

    expect(view).toContain(">Submit Anyway</button>");
    expect(view).not.toContain("disabled=");
    expect(view).toContain("Application Programming Interface");
    expect(view).toContain('name="confirmDuplicate"');
  });

  it("recovers submitted values and field errors", () => {
    renderForm({
      status: "error",
      errors: { acronym: ["Acronym is required."] },
      exactDuplicate: null,
      values: {
        acronym: "",
        definition: "Application Programming Interface",
        notes: "Recovered notes",
      },
    });

    expect(screen.getByRole("textbox", { name: /^Acronym/ })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Definition" })).toHaveValue(
      "Application Programming Interface",
    );
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue(
      "Recovered notes",
    );
    expect(screen.getByText("Acronym is required.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Acronym" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("textbox", { name: "Acronym" })).toHaveAttribute(
      "aria-describedby",
      expect.stringMatching(/-error$/),
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("shows exact feedback without repeating the duplicate field error", () => {
    renderForm({
      status: "error",
      errors: { definition: [exactDuplicateMessage] },
      exactDuplicate: existingEntry,
      values: {
        acronym: "API",
        definition: "Application Programming Interface",
      },
    });

    const form = screen.getByRole("form", { name: "New dictionary entry" });
    expect(within(form).getByRole("heading", { name: "This definition already exists" })).toBeVisible();
    expect(within(form).getByText(existingEntry.definition)).toBeVisible();
    expect(within(form).queryByRole("button", { name: "See warning" })).not.toBeInTheDocument();
    expect(screen.queryByText(exactDuplicateMessage)).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Definition" }),
    ).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Definition" }), {
      target: { value: "Annual Performance Index" },
    });
    expect(
      screen.queryByRole("button", { name: "See warning" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("preserves confirmation state for a similar-definition warning", () => {
    renderForm({
      status: "duplicate-warning",
      existingEntries: [existingEntry],
      values: {
        acronym: "API",
        definition: "Annual Performance Index",
      },
    });

    const form = screen.getByRole("form", { name: "New dictionary entry" });
    expect(within(form).getByRole("heading", { name: "API already exists" })).toBeVisible();
    expect(within(form).getByText(existingEntry.definition)).toBeVisible();
    expect(within(form).queryByRole("button", { name: "See warning" })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("true")).toHaveAttribute(
      "name",
      "confirmDuplicate",
    );
    expect(screen.getByRole("button", { name: "Submit Anyway" })).toBeEnabled();
  });

  it("renders the unchanged empty form without duplicate feedback", () => {
    renderForm();

    expect(
      screen.queryByRole("button", { name: "See warning" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Acronym" })).toBeRequired();
    expect(
      screen.getByRole("textbox", { name: "Definition" }),
    ).toBeRequired();
    expect(screen.getByRole("textbox", { name: "Notes" })).not.toBeRequired();
    expect(screen.getAllByText("(required)", { selector: "span" })).toHaveLength(
      2,
    );
    expect(screen.getByText("(optional)")).toBeVisible();

    fireEvent.change(screen.getByRole("textbox", { name: "Acronym" }), {
      target: { value: "API" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Definition" }), {
      target: { value: "Application Programming Interface" },
    });
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });
});

function renderForm(actionData?: SubmissionActionData) {
  const Routes = createRoutesStub([
    {
      path: "/",
      Component: () => <SubmissionForm actionData={actionData} />,
    },
  ]);

  return render(<Routes />);
}
