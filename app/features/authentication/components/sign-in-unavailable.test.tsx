// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignInUnavailable } from "./sign-in-unavailable";

describe("sign-in unavailable", () => {
  it("explains the configuration requirement without blocking browsing", () => {
    render(<SignInUnavailable />);

    expect(
      screen.getByRole("heading", { name: "Sign-in is not configured" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to dictionary" }),
    ).toHaveAttribute("href", "/");
  });
});
