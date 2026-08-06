// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert } from "./alert";
import { Card } from "./card";
import { PageShell } from "./page-shell";

describe("shared surfaces", () => {
  it("leaves alert live-region behavior to the caller", () => {
    const { rerender } = render(
      <Alert variant="warning">Review this message.</Alert>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Review this message.")).toBeVisible();

    rerender(
      <Alert variant="destructive" role="alert">
        Submission failed.
      </Alert>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Submission failed.");
  });

  it("renders content in a neutral card without adding landmark semantics", () => {
    render(<Card>Dictionary entry</Card>);

    expect(screen.getByText("Dictionary entry")).toBeVisible();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("provides one main landmark around a page's content", () => {
    render(
      <PageShell width="narrow">
        <h1>Sign out</h1>
      </PageShell>,
    );

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "Sign out" }),
    );
  });
});
