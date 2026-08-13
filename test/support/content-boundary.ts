import { expect } from "vitest";

export const controlledContentSentinel =
  "CONTROLLED_DICTIONARY_CONTENT_7D4F2A";

export function expectContentFreeMetadata(
  value: unknown,
  sentinel = controlledContentSentinel,
) {
  expect(JSON.stringify(value)).not.toContain(sentinel);
}

export function expectContentFreeResponseMetadata(
  response: Response,
  sentinel = controlledContentSentinel,
) {
  expectContentFreeMetadata(
    {
      headers: Object.fromEntries(response.headers),
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    },
    sentinel,
  );
}
