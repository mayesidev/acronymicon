import { describe, expect, expectTypeOf, it } from "vitest";

import {
  AuditRecorder,
  expectAuditAttempts,
} from "../../test/support/audit-recorder";
import {
  auditActions,
  type AuditEvent,
  type AuditEventInput,
  type AuditPublication,
} from "./audit";

const loginEvent = {
  correlationId: "correlation-1",
  actor: { type: "user", id: "user-1" },
  source: "http",
  action: "authentication.login",
  target: { type: "session", id: "session-1" },
  outcome: "succeeded",
} satisfies AuditEventInput;

const deniedEvent = {
  correlationId: "correlation-2",
  actor: { type: "user", id: "user-2" },
  source: "http",
  action: "authorization.check",
  target: { type: "application" },
  outcome: "denied",
} satisfies AuditEventInput;

describe("audit contract", () => {
  it("defines actions only for current operations and sink health", () => {
    expect(auditActions).toEqual([
      "authentication.login",
      "authentication.logout",
      "authentication.reauthenticate",
      "authorization.check",
      "acronym.submit",
      "acronym.import",
      "database.migrate",
      "audit.sink.append",
    ]);
  });

  it("keeps producer input separate from publisher-owned record fields", () => {
    expectTypeOf<keyof AuditEventInput>().toEqualTypeOf<
      "correlationId" | "actor" | "source" | "action" | "target" | "outcome"
    >();
    expectTypeOf<keyof AuditEvent>().toEqualTypeOf<
      keyof AuditEventInput | "schemaVersion" | "timestamp"
    >();
  });
});

describe("AuditRecorder", () => {
  it("records publication attempts in producer order", async () => {
    const recorder = new AuditRecorder();
    const attempts = [
      { delivery: "best-effort", event: loginEvent },
      { delivery: "required", event: deniedEvent },
    ] satisfies AuditPublication[];

    await expect(recorder.publish(attempts[0])).resolves.toEqual({
      status: "recorded",
    });
    await expect(recorder.publish(attempts[1])).resolves.toEqual({
      status: "recorded",
    });

    expectAuditAttempts(recorder, attempts);
  });

  it.each(["required", "best-effort"] as const)(
    "makes unavailable %s publication explicit",
    async (delivery) => {
      const recorder = new AuditRecorder({ available: false });

      await expect(
        recorder.publish({ delivery, event: deniedEvent }),
      ).resolves.toEqual({ status: "unavailable", delivery });
    },
  );

  it("can simulate sink recovery", async () => {
    const recorder = new AuditRecorder({ available: false });
    const publication = {
      delivery: "required",
      event: deniedEvent,
    } satisfies AuditPublication;

    await expect(recorder.publish(publication)).resolves.toEqual({
      status: "unavailable",
      delivery: "required",
    });
    recorder.setAvailable(true);
    await expect(recorder.publish(publication)).resolves.toEqual({
      status: "recorded",
    });
  });

  it("returns attempt snapshots that cannot mutate recorded history", async () => {
    const recorder = new AuditRecorder();
    const publication = {
      delivery: "best-effort",
      event: loginEvent,
    } satisfies AuditPublication;

    await recorder.publish(publication);
    const attempts = recorder.attempts as AuditPublication[];
    attempts.length = 0;

    expect(recorder.attempts).toEqual([publication]);
  });
});
