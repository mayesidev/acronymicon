import { eq } from "drizzle-orm";

import type { SessionRepository } from "../../features/authentication/server/session-repository";
import type { AppDatabase } from "./client.server";
import { authenticatedSessions } from "./schema";

type SessionRepositoryDependencies = Readonly<{
  now: () => Date;
  randomId: () => string;
}>;

const defaultDependencies: SessionRepositoryDependencies = {
  now: () => new Date(),
  randomId: () => crypto.randomUUID(),
};

export function createDatabaseSessionRepository(
  database: AppDatabase,
  dependencies: SessionRepositoryDependencies = defaultDependencies,
): SessionRepository {
  return {
    async create(data, expiresAt) {
      const id = dependencies.randomId();
      await database.insert(authenticatedSessions).values({
        id,
        data,
        expiresAt: expiresAt.toISOString(),
      });
      return id;
    },

    async read(id) {
      const [record] = await database
        .select({
          data: authenticatedSessions.data,
          expiresAt: authenticatedSessions.expiresAt,
        })
        .from(authenticatedSessions)
        .where(eq(authenticatedSessions.id, id))
        .limit(1);

      if (!record) {
        return null;
      }

      if (
        new Date(record.expiresAt).getTime() <= dependencies.now().getTime()
      ) {
        await database
          .delete(authenticatedSessions)
          .where(eq(authenticatedSessions.id, id));
        return null;
      }

      return record.data;
    },

    async update(id, data, expiresAt) {
      await database
        .update(authenticatedSessions)
        .set({
          data,
          expiresAt: expiresAt.toISOString(),
          updatedAt: dependencies.now().toISOString(),
        })
        .where(eq(authenticatedSessions.id, id));
    },

    async delete(id) {
      await database
        .delete(authenticatedSessions)
        .where(eq(authenticatedSessions.id, id));
    },
  };
}
