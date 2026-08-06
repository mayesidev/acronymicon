// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("button", () => {
  it("renders an enabled command with a safe default type", () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("exposes pending submit commands as busy and disabled", () => {
    render(
      <Button type="submit" pending variant="secondary">
        Saving
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("preserves an explicitly disabled text command", () => {
    render(
      <Button disabled variant="text">
        Remove
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });
});
