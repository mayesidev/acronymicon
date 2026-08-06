// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "./field";
import { Input, formControlClassName } from "./input";
import { NativeSelect } from "./native-select";
import { Textarea } from "./textarea";

describe("form controls", () => {
  it("shares the interactive control contract", () => {
    render(
      <>
        <Input type="search" aria-label="Search" disabled />
        <Textarea aria-label="Notes" />
        <NativeSelect aria-label="Sort">
          <option>Alphabetical</option>
        </NativeSelect>
      </>,
    );

    for (const control of [
      screen.getByRole("searchbox", { name: "Search" }),
      screen.getByRole("textbox", { name: "Notes" }),
      screen.getByRole("combobox", { name: "Sort" }),
    ]) {
      expect(control).toHaveClass(...formControlClassName.split(" "));
    }
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeDisabled();
  });

  it("connects a label, description, and error to its control", () => {
    render(
      <Field
        id="acronym"
        label="Acronym"
        description="Use the common abbreviation."
        error="Acronym is required."
      >
        <Input name="acronym" aria-describedby="form-help" />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Acronym" });
    expect(input).toHaveAttribute("id", "acronym");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "form-help acronym-description acronym-error",
    );
    expect(screen.getByText("Use the common abbreviation.")).toHaveAttribute(
      "id",
      "acronym-description",
    );
    expect(screen.getByText("Acronym is required.")).toHaveAttribute(
      "id",
      "acronym-error",
    );
  });

  it("generates stable relationships without marking a valid field invalid", () => {
    render(
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>,
    );

    const textarea = screen.getByRole("textbox", { name: "Notes" });
    expect(textarea.id).not.toBe("");
    expect(screen.getByText("Notes")).toHaveAttribute("for", textarea.id);
    expect(textarea).not.toHaveAttribute("aria-describedby");
    expect(textarea).not.toHaveAttribute("aria-invalid");
  });
});
