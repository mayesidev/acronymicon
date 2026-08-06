// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionLink, TextLink } from "./link";

describe("shared links", () => {
  it("preserves navigation semantics for action and text links", () => {
    render(
      <>
        <ActionLink href="/create">Create</ActionLink>
        <ActionLink href="/cancel" variant="secondary">
          Cancel
        </ActionLink>
        <TextLink href="/details">View details</TextLink>
      </>,
    );

    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/cancel",
    );
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute(
      "href",
      "/details",
    );
  });

  it("prevents disabled links from navigating or invoking handlers", () => {
    const onClick = vi.fn();

    render(
      <TextLink href="/details" disabled onClick={onClick}>
        View details
      </TextLink>,
    );

    const link = screen.getByRole("link", { name: "View details" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(fireEvent.click(link)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("exposes pending action links as busy and inactive", () => {
    render(
      <ActionLink href="/next" pending>
        Continuing
      </ActionLink>,
    );

    const link = screen.getByRole("link", { name: "Continuing" });
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");
  });

  it("invokes enabled link handlers and preserves an explicit tab index", () => {
    const onClick = vi.fn();

    render(
      <TextLink href="#details" onClick={onClick} tabIndex={0}>
        View details
      </TextLink>,
    );

    const link = screen.getByRole("link", { name: "View details" });
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
    expect(link).toHaveAttribute("tabindex", "0");
    expect(link).not.toHaveAttribute("aria-disabled");
  });
});
