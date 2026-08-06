// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { SignOutConfirmation } from "./sign-out-confirmation";

describe("sign-out confirmation", () => {
  it("submits logout while preserving a cancel path", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/auth/logout",
          element: <SignOutConfirmation />,
        },
      ],
      { initialEntries: ["/auth/logout"] },
    );

    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
