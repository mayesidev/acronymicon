// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { AccessNotice } from "./access-notice";
import { DataPageShell } from "./data-page-shell";

describe("deployment notices", () => {
  it("renders approved access text and a native sign-in form", async () => {
    const Routes = createRoutesStub([
      {
        path: "/auth/login",
        Component: () => <AccessNotice notice={"Authorized users only.\nActivity may be reviewed."} token="signed-token" returnTo="/submit" />,
      },
    ]);

    render(<Routes initialEntries={["/auth/login?returnTo=%2Fsubmit"]} />);

    expect(
      await screen.findByRole("heading", { name: "Before you sign in" }),
    ).toBeVisible();
    expect(screen.getByText(/Authorized users only/)).toHaveTextContent(
      "Authorized users only. Activity may be reviewed.",
    );
    expect(
      screen.getByRole("form", { name: "Continue to sign in" }),
    ).toHaveAttribute("method", "post");
    expect(
      screen.getByRole("form", { name: "Continue to sign in" }),
    ).toHaveAttribute("action", "/auth/login?returnTo=%2Fsubmit");
    expect(screen.getByDisplayValue("signed-token")).toHaveAttribute(
      "name",
      "noticeToken",
    );
  });

  it("shows a label before page content only when configured", () => {
    const { rerender } = render(
      <DataPageShell sensitivityLabel="Controlled content">
        <h1>Dictionary</h1>
      </DataPageShell>,
    );

    expect(screen.getByRole("complementary", {
      name: "Content handling notice",
    })).toHaveTextContent("Controlled content");
    expect(screen.getByRole("main")).toHaveTextContent(
      /^Controlled contentDictionary$/,
    );

    rerender(
      <DataPageShell>
        <h1>Dictionary</h1>
      </DataPageShell>,
    );
    expect(
      screen.queryByRole("complementary", { name: "Content handling notice" }),
    ).not.toBeInTheDocument();
  });
});
