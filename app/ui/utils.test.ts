import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins conditional class names", () => {
    expect(
      cn("font-medium", ["text-sm"], {
        underline: true,
        italic: false,
      }),
    ).toBe("font-medium text-sm underline");
  });

  it("keeps the last conflicting Tailwind class", () => {
    expect(cn("bg-white px-2", "bg-slate-950 px-4")).toBe(
      "bg-slate-950 px-4",
    );
  });
});
