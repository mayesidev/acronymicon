// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { HeaderActions } from "./header-actions";

describe("header actions", () => {
  it("groups sign-out with the signed-in identity", () => {
    renderActions({
      id: "user-1",
      username: "local-user",
      displayName: "Local User",
      groups: [],
    });

    const account = screen.getByRole("group", { name: "Account" });

    expect(within(account).getByText("Signed in as")).toBeInTheDocument();
    expect(within(account).getByText("Local User")).toBeInTheDocument();
    expect(
      within(account).getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      within(account).queryByRole("link", { name: "Submit acronym" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Submit acronym" }),
    ).toHaveClass("bg-slate-950", "text-white");
  });

  it("presents sign-in as a visible text link", () => {
    renderActions(null);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass(
      "text-link",
    );
  });
});

function renderActions(user: Parameters<typeof HeaderActions>[0]["user"]) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <HeaderActions user={user} />,
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}
