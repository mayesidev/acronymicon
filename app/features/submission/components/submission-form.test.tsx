// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import type { SubmissionActionData } from "../model";
import { exactDuplicateMessage } from "../policy";
import { SubmissionForm } from "./submission-form";

const existingEntry = {
  id: "existing-id",
  definition: "Application Programming Interface",
};

afterEach(cleanup);

describe("submission form", () => {
  it("recovers submitted values and field errors", () => {
    const { container } = renderForm({
      status: "error",
      errors: { acronym: ["Acronym is required."] },
      exactDuplicate: null,
      values: {
        acronym: "",
        definition: "Application Programming Interface",
        notes: "Recovered notes",
      },
    });

    expect(container.querySelector('input[name="acronym"]')).toHaveValue("");
    expect(container.querySelector('input[name="definition"]')).toHaveValue(
      "Application Programming Interface",
    );
    expect(container.querySelector('textarea[name="notes"]')).toHaveValue(
      "Recovered notes",
    );
    expect(screen.getByText("Acronym is required.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("shows exact feedback without repeating the duplicate field error", () => {
    const { container } = renderForm({
      status: "error",
      errors: { definition: [exactDuplicateMessage] },
      exactDuplicate: existingEntry,
      values: {
        acronym: "API",
        definition: "Application Programming Interface",
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This definition already exists",
    );
    expect(screen.queryByText(exactDuplicateMessage)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    fireEvent.change(container.querySelector('input[name="definition"]')!, {
      target: { value: "Annual Performance Index" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("preserves confirmation state for a similar-definition warning", () => {
    const { container } = renderForm({
      status: "duplicate-warning",
      existingEntries: [existingEntry],
      values: {
        acronym: "API",
        definition: "Annual Performance Index",
      },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      existingEntry.definition,
    );
    expect(
      container.querySelector('input[name="confirmDuplicate"]'),
    ).toHaveValue("true");
    expect(screen.getByRole("button", { name: "Submit Anyway" })).toBeEnabled();
  });

  it("renders the unchanged empty form without duplicate feedback", () => {
    const { container } = renderForm();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    fireEvent.change(container.querySelector('input[name="acronym"]')!, {
      target: { value: "API" },
    });
    fireEvent.change(container.querySelector('input[name="definition"]')!, {
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
