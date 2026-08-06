import { describe, expect, it } from "vitest";

import { loadAboutPage } from "./api";

describe("About page API", () => {
  it("combines build metadata with a safe return location", () => {
    expect(
      loadAboutPage(
        new Request(
          "https://app.example.test/about?returnTo=%2F%3Fq%3DAPI",
        ),
      ),
    ).toEqual({
      returnTo: "/?q=API",
      version: "development",
    });
  });
});
