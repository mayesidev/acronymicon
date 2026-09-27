import { describe, expect, it } from "vitest";

import { AuditRecorder } from "../../../../test/support/audit-recorder";
import {
  controlledContentSentinel,
  expectContentFreeMetadata,
} from "../../../../test/support/content-boundary";
import { recordControlledDictionaryRead } from "./read-audit";

const user = {
  id: "reader-id",
  username: controlledContentSentinel,
  displayName: controlledContentSentinel,
  groups: ["readers"],
};

describe("controlled dictionary read audit", () => {
  it("records one required bounded event without user display or content fields", async () => {
    const recorder = new AuditRecorder();

    await recordControlledDictionaryRead(user, recorder, () => "correlation-1");

    expect(recorder.attempts).toEqual([
      {
        delivery: "required",
        event: {
          correlationId: "correlation-1",
          actor: { type: "user", id: "reader-id" },
          source: "http",
          action: "dictionary.read",
          target: { type: "application" },
          outcome: "succeeded",
        },
      },
    ]);
    expectContentFreeMetadata(recorder.attempts);
  });

  it("blocks content when the audit sink is unavailable", async () => {
    const recorder = new AuditRecorder({ available: false });

    await expect(
      recordControlledDictionaryRead(user, recorder),
    ).rejects.toMatchObject({ status: 503 });
    expect(recorder.attempts).toHaveLength(1);
  });
});
