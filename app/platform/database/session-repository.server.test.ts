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

    await repository.delete("opaque-session-id");
    await expect(repository.read("opaque-session-id")).resolves.toBeNull();
  });

  it("rejects and removes an expired session", async () => {
    resource = createTestDatabase();
    const repository = createDatabaseSessionRepository(resource.db, {
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
});

function createTestDatabase() {
  return createDatabase({
    databasePath: ":memory:",
    migrationsFolder: "./drizzle",
    runMigrations: true,
  });
}
