import { describe, expect, it } from "vitest";

import { buildAboutHref, resolveAboutReturnTo } from "./model";

describe("About navigation", () => {
  it("preserves an internal dictionary URL in the About link", () => {
    expect(buildAboutHref("/?q=API&sort=recent")).toBe(
      "/about?returnTo=%2F%3Fq%3DAPI%26sort%3Drecent",
    );
    expect(resolveAboutReturnTo("/define/opaque-id?view=all#definition")).toBe(
      "/define/opaque-id?view=all#definition",
    );
  });

  it("keeps controlled About return links free of untrusted query text", () => {
    const entryId = "5b3b6c8d-3930-40b1-b09b-dc8ec56860de";

    expect(buildAboutHref("/?q=SECRET&sort=recent", true)).toBe(
      "/about?returnTo=%2F",
    );
    expect(
      resolveAboutReturnTo(
        `/define/${entryId}?view=all&sort=recent&context=SECRET`,
        true,
      ),
    ).toBe(`/define/${entryId}?view=all&sort=recent`);
  });

  it.each([
    null,
    "",
    "https://example.test",
    "//example.test",
    "/\\example.test",
    "/_.data?q=API&sort=alphabetical",
    "/define?acr=api&var=1#definition",
  ])(
    "falls back to the dictionary for an unsafe return location (%s)",
    (value) => {
      expect(resolveAboutReturnTo(value)).toBe("/");
    },
  );
});
