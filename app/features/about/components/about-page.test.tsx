// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { licenseUrl, sourceRepositoryUrl } from "../model";
import { AboutPage } from "./about-page";

describe("About page", () => {
  it("identifies the build and provides accessible project links", () => {
    render(<AboutPage version="v1.2.3" returnTo="/?q=API&sort=recent" />);

    expect(
      screen.getByRole("heading", { name: "About Acronymicon" }),
    ).toBeVisible();
    expect(screen.getByText("v1.2.3")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to dictionary" }),
    ).toHaveAttribute("href", "/?q=API&sort=recent");
    expect(
      screen.getByRole("link", { name: "Read the MIT License" }),
    ).toHaveAttribute("href", licenseUrl);
    expect(
      screen.getByRole("link", {
        name: "View Acronymicon source on GitHub",
      }),
    ).toHaveAttribute("href", sourceRepositoryUrl);
  });
});
