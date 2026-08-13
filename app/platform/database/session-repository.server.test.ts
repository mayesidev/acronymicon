import { afterEach, describe, expect, it } from "vitest";

import { createDatabase, type DatabaseResource } from "./client.server";
import { createDatabaseSessionRepository } from "./session-repository.server";
import { authenticatedSessions } from "./schema";

describe("database session repository", () => {
  let resource: DatabaseResource | undefined;

  afterEach(() => resource?.close());

  it("creates, reads, updates, and revokes session records", async () => {
    resource = createTestDatabase();
    let now = new Date("2026-08-13T00:00:00.000Z");
    const repository = createDatabaseSessionRepository(resource.db, {
      absoluteTimeoutMilliseconds: 8 * 60 * 60 * 1_000,
      inactivityTimeoutMilliseconds: 30 * 60 * 1_000,
      now: () => now,
      randomId: () => "opaque-session-id",
    });
    const initialExpiry = new Date("2026-08-13T08:00:00.000Z");

    await expect(
      repository.create({ user: { id: "user-123" } }, initialExpiry),
    ).resolves.toBe("opaque-session-id");
    await expect(repository.read("opaque-session-id")).resolves.toEqual({
      user: { id: "user-123" },
    });

    now = new Date("2026-08-13T01:00:00.000Z");
    await repository.update(
      "opaque-session-id",
      { user: { id: "user-456" } },
      new Date("2026-08-13T09:00:00.000Z"),
    );
    await expect(repository.read("opaque-session-id")).resolves.toEqual({
      user: { id: "user-456" },
    });
    await expect(
      resource.db
        .select({ expiresAt: authenticatedSessions.expiresAt })
        .from(authenticatedSessions),
    ).resolves.toEqual([{ expiresAt: initialExpiry.toISOString() }]);

    await repository.delete("opaque-session-id");
    await expect(repository.read("opaque-session-id")).resolves.toBeNull();
  });

  it("rejects and removes an expired session", async () => {
    resource = createTestDatabase();
    const repository = createDatabaseSessionRepository(resource.db, {
      absoluteTimeoutMilliseconds: 8 * 60 * 60 * 1_000,
      inactivityTimeoutMilliseconds: 30 * 60 * 1_000,
      now: () => new Date("2026-08-13T08:00:00.000Z"),
      randomId: () => "expired-session-id",
    });

    await repository.create(
      { user: { id: "user-123" } },
      new Date("2026-08-13T07:59:59.000Z"),
    );

    await expect(repository.read("expired-session-id")).resolves.toBeNull();
    await expect(
      resource.db.select().from(authenticatedSessions),
    ).resolves.toEqual([]);
  });

  it("advances authenticated activity without extending absolute expiry", async () => {
    resource = createTestDatabase();
    let now = new Date("2026-08-13T00:00:00.000Z");
    const repository = createDatabaseSessionRepository(resource.db, {
      absoluteTimeoutMilliseconds: 8 * 60 * 60 * 1_000,
      inactivityTimeoutMilliseconds: 30 * 60 * 1_000,
      now: () => now,
      randomId: () => "active-session-id",
    });
    const absoluteExpiry = new Date("2026-08-13T08:00:00.000Z");
    await repository.create({ user: { id: "user-123" } }, absoluteExpiry);

    now = new Date("2026-08-13T00:29:00.000Z");
    await expect(repository.read("active-session-id")).resolves.toEqual({
      user: { id: "user-123" },
    });

    now = new Date("2026-08-13T00:58:00.000Z");
    await expect(repository.read("active-session-id")).resolves.toEqual({
      user: { id: "user-123" },
    });

    now = new Date("2026-08-13T01:28:00.000Z");
    await expect(repository.read("active-session-id")).resolves.toBeNull();

    now = new Date("2026-08-13T07:59:59.000Z");
    await repository.create({ user: { id: "user-456" } }, absoluteExpiry);
    now = absoluteExpiry;
    await expect(repository.read("active-session-id")).resolves.toBeNull();
  });

  it("applies a reduced absolute policy to an existing session", async () => {
    resource = createTestDatabase();
    let now = new Date("2026-08-13T00:00:00.000Z");
    const longPolicyRepository = createDatabaseSessionRepository(resource.db, {
      absoluteTimeoutMilliseconds: 8 * 60 * 60 * 1_000,
      inactivityTimeoutMilliseconds: 8 * 60 * 60 * 1_000,
      now: () => now,
      randomId: () => "policy-change-session-id",
    });
    await longPolicyRepository.create(
      { user: { id: "user-123" } },
      new Date("2026-08-13T08:00:00.000Z"),
    );

    now = new Date("2026-08-13T00:30:00.000Z");
    const reducedPolicyRepository = createDatabaseSessionRepository(
      resource.db,
      {
        absoluteTimeoutMilliseconds: 30 * 60 * 1_000,
        inactivityTimeoutMilliseconds: 30 * 60 * 1_000,
        now: () => now,
      },
    );

    await expect(
      reducedPolicyRepository.read("policy-change-session-id"),
    ).resolves.toBeNull();
  });
});

function createTestDatabase() {
  return createDatabase({
    databasePath: ":memory:",
    migrationsFolder: "./drizzle",
    runMigrations: true,
  });
}
