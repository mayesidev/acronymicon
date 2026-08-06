import { describe, expect, it } from "vitest";

import { resolveApplicationVersion } from "./build-metadata";

describe("build metadata", () => {
  it("uses supplied release metadata", () => {
    expect(resolveApplicationVersion(" v1.2.3 ")).toBe("v1.2.3");
  });

  it.each([undefined, null, "", "   "])(
    "uses a development label when release metadata is unavailable (%s)",
    (value) => {
      expect(resolveApplicationVersion(value)).toBe("development");
    },
  );
});
