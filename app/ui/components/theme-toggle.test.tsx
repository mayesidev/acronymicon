// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "./theme-toggle";

describe("shared theme toggle", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("stores an explicit theme preference when toggled", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle color theme" }));

    expect(window.localStorage.getItem("acronymicon-theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(
      screen.getByRole("button", { name: "Toggle color theme" }),
    ).toBeInTheDocument();
  });
});
