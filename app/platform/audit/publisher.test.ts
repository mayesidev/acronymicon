import { describe, expect, it, vi } from "vitest";

import type {
  AuditClock,
  AuditEventInput,
  AuditPublication,
  AuditSink,
} from "../../domain/audit";
import { createAuditPublisher } from "./publisher";

const eventInput = {
  correlationId: "correlation-1",
  actor: { type: "user", id: "user-1" },
  source: "http",
  action: "authorization.check",
  target: { type: "application" },
  outcome: "denied",
} satisfies AuditEventInput;

const fixedClock: AuditClock = {
  now: () => new Date("2026-08-13T01:30:00.000Z"),
};

describe("createAuditPublisher", () => {
  it("appends one complete versioned record with the injected timestamp", async () => {
    const append = vi.fn<AuditSink["append"]>().mockResolvedValue({
      status: "recorded",
    });
    const publisher = createAuditPublisher({
      clock: fixedClock,
      sink: { append },
    });

    await expect(
      publisher.publish({ delivery: "required", event: eventInput }),
    ).resolves.toEqual({ status: "recorded" });
    expect(append).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith({
      ...eventInput,
      schemaVersion: 1,
      timestamp: "2026-08-13T01:30:00.000Z",
    });
  });

  it("does not allow producer values to override publisher-owned fields", async () => {
    const append = vi.fn<AuditSink["append"]>().mockResolvedValue({
      status: "recorded",
    });
    const publisher = createAuditPublisher({
      clock: fixedClock,
      sink: { append },
    });
    const untrustedInput = {
      ...eventInput,
      schemaVersion: 999,
      timestamp: "2000-01-01T00:00:00.000Z",
    } as AuditEventInput;

    await publisher.publish({ delivery: "required", event: untrustedInput });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 1,
        timestamp: "2026-08-13T01:30:00.000Z",
      }),
    );
  });

  it.each(["required", "best-effort"] as const)(
    "preserves %s delivery when the sink reports unavailability",
    async (delivery) => {
      const sink: AuditSink = {
        append: () => Promise.resolve({ status: "unavailable" }),
      };
      const publisher = createAuditPublisher({ clock: fixedClock, sink });

      await expect(
        publisher.publish({ delivery, event: eventInput }),
      ).resolves.toEqual({ status: "unavailable", delivery });
    },
  );

  it.each([
    ["reported", () => Promise.resolve({ status: "unavailable" as const })],
    ["rejected", () => Promise.reject(new Error("private sink error"))],
  ])(
    "writes one bounded fallback record for %s unavailability",
    async (_, append) => {
      const fallbackAppend = vi
        .fn<AuditSink["append"]>()
        .mockResolvedValue({ status: "recorded" });
      const publisher = createAuditPublisher({
        clock: fixedClock,
        sink: { append },
        fallbackSink: { append: fallbackAppend },
      });

      await expect(
        publisher.publish({ delivery: "required", event: eventInput }),
      ).resolves.toEqual({ status: "unavailable", delivery: "required" });
      expect(fallbackAppend).toHaveBeenCalledOnce();
      expect(fallbackAppend).toHaveBeenCalledWith({
        schemaVersion: 1,
        timestamp: "2026-08-13T01:30:00.000Z",
        correlationId: "correlation-1",
        actor: { type: "system" },
        source: "http",
        action: "audit.sink.append",
        target: { type: "application" },
        outcome: "failed",
      });
      expect(JSON.stringify(fallbackAppend.mock.calls)).not.toContain("user-1");
      expect(JSON.stringify(fallbackAppend.mock.calls)).not.toContain(
        "private",
      );
    },
  );

  it("does not report recorded appends to the fallback", async () => {
    const fallbackAppend = vi.fn<AuditSink["append"]>();
    const publisher = createAuditPublisher({
      clock: fixedClock,
      sink: { append: () => Promise.resolve({ status: "recorded" }) },
      fallbackSink: { append: fallbackAppend },
    });

    await publisher.publish({ delivery: "required", event: eventInput });

    expect(fallbackAppend).not.toHaveBeenCalled();
  });

  it.each([
    ["reported", () => Promise.resolve({ status: "unavailable" as const })],
    ["rejected", () => Promise.reject(new Error("fallback unavailable"))],
  ])(
    "ignores %s fallback failure without recursion",
    async (_, fallbackAppend) => {
      const primaryAppend = vi
        .fn<AuditSink["append"]>()
        .mockResolvedValue({ status: "unavailable" });
      const publisher = createAuditPublisher({
        clock: fixedClock,
        sink: { append: primaryAppend },
        fallbackSink: { append: vi.fn(fallbackAppend) },
      });

      await expect(
        publisher.publish({ delivery: "best-effort", event: eventInput }),
      ).resolves.toEqual({
        status: "unavailable",
        delivery: "best-effort",
      });
      expect(primaryAppend).toHaveBeenCalledOnce();
    },
  );

  it.each(["required", "best-effort"] as const)(
    "maps a rejected %s sink call to unavailability",
    async (delivery) => {
      const sink: AuditSink = {
        append: () => Promise.reject(new Error("sink unavailable")),
      };
      const publisher = createAuditPublisher({ clock: fixedClock, sink });

      await expect(
        publisher.publish({ delivery, event: eventInput }),
      ).resolves.toEqual({ status: "unavailable", delivery });
    },
  );

  it("preserves awaited producer order", async () => {
    const appendedActions: string[] = [];
    const sink: AuditSink = {
      append: (event) => {
        appendedActions.push(event.action);
        return Promise.resolve({ status: "recorded" });
      },
    };
    const publisher = createAuditPublisher({ clock: fixedClock, sink });
    const publications = [
      { delivery: "best-effort", event: eventInput },
      {
        delivery: "best-effort",
        event: { ...eventInput, action: "authentication.logout" },
      },
    ] satisfies AuditPublication[];

    for (const publication of publications) {
      await publisher.publish(publication);
    }

    expect(appendedActions).toEqual([
      "authorization.check",
      "authentication.logout",
    ]);
  });
});
