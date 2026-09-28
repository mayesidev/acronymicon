import { afterEach, describe, expect, it } from "vitest";

import { AuditRecorder } from "../../../test/support/audit-recorder";
import { createDatabase, type DatabaseResource } from "./client.server";
import { authenticatedSessions } from "./schema";
import { revokeUserSessions } from "./session-revocation.server";

describe("operator session revocation", () => {
  let resource: DatabaseResource | undefined;

  afterEach(() => resource?.close());

  it("revokes every session for an exact provider user ID and records one bounded event", async () => {
    resource = testDatabase();
    await addSessions(resource, [
      ["session-1", "user-1"],
      ["session-2", "user-1"],
      ["session-3", "user-10"],
      ["session-4", "other' OR 1=1"],
    ]);
    const audit = new AuditRecorder();

    await expect(revokeUserSessions(resource.db, "user-1", audit)).resolves.toEqual({
      revokedCount: 2,
      auditStatus: "recorded",
    });
    expect(await sessionIds(resource)).toEqual(["session-3", "session-4"]);
    expect(audit.attempts).toMatchObject([
      {
        delivery: "best-effort",
        event: {
          actor: { type: "system" },
          source: "maintenance",
          action: "session.revoke",
          target: { type: "identity", id: "user-1" },
          outcome: "succeeded",
        },
      },
    ]);
    expect(audit.attempts[0]?.event.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not match SQL syntax in a provider ID and reports an empty result", async () => {
    resource = testDatabase();
    await addSessions(resource, [["session-1", "user-1"]]);
    const audit = new AuditRecorder();

    await expect(
      revokeUserSessions(resource.db, "' OR 1=1 --", audit),
    ).resolves.toEqual({ revokedCount: 0, auditStatus: "recorded" });
    expect(await sessionIds(resource)).toEqual(["session-1"]);
  });

  it("revokes sessions even when the audit sink is unavailable", async () => {
    resource = testDatabase();
    await addSessions(resource, [["session-1", "user-1"]]);
    const audit = new AuditRecorder({ available: false });

    await expect(revokeUserSessions(resource.db, "user-1", audit)).resolves.toEqual({
      revokedCount: 1,
      auditStatus: "unavailable",
    });
    expect(await sessionIds(resource)).toEqual([]);
    expect(audit.attempts[0]?.event.outcome).toBe("succeeded");
  });

  it("rejects an empty provider ID without touching sessions", async () => {
    resource = testDatabase();
    await addSessions(resource, [["session-1", "user-1"]]);
    const audit = new AuditRecorder();

    await expect(revokeUserSessions(resource.db, " ", audit)).rejects.toThrow(
      "Provider user ID is required.",
    );
    expect(await sessionIds(resource)).toEqual(["session-1"]);
    expect(audit.attempts).toEqual([]);
  });
});

function testDatabase() {
  return createDatabase({
    databasePath: ":memory:",
    migrationsFolder: "./drizzle",
    runMigrations: true,
  });
}

async function addSessions(
  resource: DatabaseResource,
  sessions: Array<[id: string, userId: string]>,
) {
  await resource.db.insert(authenticatedSessions).values(
    sessions.map(([id, userId]) => ({
      id,
      data: { user: { id: userId } },
      expiresAt: "2026-09-28T00:00:00.000Z",
    })),
  );
}

async function sessionIds(resource: DatabaseResource) {
  return (await resource.db.select({ id: authenticatedSessions.id }).from(authenticatedSessions))
    .map((record) => record.id)
    .sort();
}
