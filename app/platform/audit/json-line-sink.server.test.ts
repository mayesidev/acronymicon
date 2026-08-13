import { describe, expect, it, vi } from "vitest";

import type { AuditEvent } from "../../domain/audit";
import {
  createJsonLineAuditSink,
  createStandardOutputAuditSink,
  type AuditLineWriter,
  type StandardOutput,
} from "./json-line-sink.server";

const auditEvent = {
  schemaVersion: 1,
  timestamp: "2026-08-13T01:30:00.000Z",
  correlationId: "correlation-1",
  actor: { type: "user", id: "user-1" },
  source: "http",
  action: "authorization.check",
  target: { type: "application" },
  outcome: "denied",
} satisfies AuditEvent;

describe("createJsonLineAuditSink", () => {
  it("writes one parseable JSON record followed by one newline", async () => {
    const lines: string[] = [];
    const sink = createJsonLineAuditSink((line) => {
      lines.push(line);
      return Promise.resolve();
    });

    await expect(sink.append(auditEvent)).resolves.toEqual({
      status: "recorded",
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith("\n")).toBe(true);
    expect(lines[0].slice(0, -1)).not.toContain("\n");
    expect(JSON.parse(lines[0])).toEqual(auditEvent);
  });

  it("serializes concurrent writes as complete lines", async () => {
    const lines: string[] = [];
    const releases: Array<() => void> = [];
    const writeLine: AuditLineWriter = (line) => {
      lines.push(line);
      return new Promise<void>((resolve) => releases.push(resolve));
    };
    const sink = createJsonLineAuditSink(writeLine);
    const secondEvent = {
      ...auditEvent,
      correlationId: "correlation-2",
      action: "authentication.logout",
    } satisfies AuditEvent;

    const firstAppend = sink.append(auditEvent);
    const secondAppend = sink.append(secondEvent);
    await vi.waitFor(() => expect(lines).toHaveLength(1));
    releases.shift()?.();
    await vi.waitFor(() => expect(lines).toHaveLength(2));
    releases.shift()?.();

    await expect(Promise.all([firstAppend, secondAppend])).resolves.toEqual([
      { status: "recorded" },
      { status: "recorded" },
    ]);
    const parsedLines = lines.map(
      (line): unknown => JSON.parse(line) as unknown,
    );
    expect(parsedLines).toEqual([auditEvent, secondEvent]);
  });

  it("reports a rejected writer as unavailable and continues the queue", async () => {
    const writeLine = vi
      .fn<AuditLineWriter>()
      .mockRejectedValueOnce(new Error("output unavailable"))
      .mockResolvedValueOnce();
    const sink = createJsonLineAuditSink(writeLine);

    await expect(sink.append(auditEvent)).resolves.toEqual({
      status: "unavailable",
    });
    await expect(sink.append(auditEvent)).resolves.toEqual({
      status: "recorded",
    });
    expect(writeLine).toHaveBeenCalledTimes(2);
  });

  it("reports serialization failures without invoking the writer", async () => {
    const writeLine = vi.fn<AuditLineWriter>();
    const sink = createJsonLineAuditSink(writeLine);
    const circularActor = { type: "system" } as Record<string, unknown>;
    circularActor.self = circularActor;

    await expect(
      sink.append({ ...auditEvent, actor: circularActor } as AuditEvent),
    ).resolves.toEqual({ status: "unavailable" });
    expect(writeLine).not.toHaveBeenCalled();
  });
});

describe("createStandardOutputAuditSink", () => {
  it("writes the complete JSON line to standard output", async () => {
    const write = vi
      .fn<StandardOutput["write"]>()
      .mockImplementation((_line, callback) => {
        callback();
        return true;
      });
    const sink = createStandardOutputAuditSink({ write });

    await expect(sink.append(auditEvent)).resolves.toEqual({
      status: "recorded",
    });
    expect(write).toHaveBeenCalledWith(
      `${JSON.stringify(auditEvent)}\n`,
      expect.any(Function),
    );
  });
});
