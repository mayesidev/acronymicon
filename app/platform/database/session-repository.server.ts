import { eq } from "drizzle-orm";

import type { SessionRepository } from "../../features/authentication/server/session-repository";
import type { AppDatabase } from "./client.server";
import { authenticatedSessions } from "./schema";

type SessionRepositoryOptions = Readonly<{
  absoluteTimeoutMilliseconds: number;
  inactivityTimeoutMilliseconds: number;
  now?: () => Date;
  randomId?: () => string;
}>;

const defaultDependencies = {
  now: () => new Date(),
  randomId: () => crypto.randomUUID(),
};

export function createDatabaseSessionRepository(
  database: AppDatabase,
  options: SessionRepositoryOptions,
): SessionRepository {
  const dependencies = { ...defaultDependencies, ...options };

  return {
    async create(data, expiresAt) {
      const id = dependencies.randomId();
      const now = dependencies.now();
      const effectiveExpiry = Math.min(
        expiresAt.getTime(),
        now.getTime() + options.absoluteTimeoutMilliseconds,
      );
      await database.insert(authenticatedSessions).values({
        id,
        data,
        expiresAt: new Date(effectiveExpiry).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      return id;
    },

    async read(id) {
      const [record] = await database
        .select({
          data: authenticatedSessions.data,
          createdAt: authenticatedSessions.createdAt,
          expiresAt: authenticatedSessions.expiresAt,
          updatedAt: authenticatedSessions.updatedAt,
        })
        .from(authenticatedSessions)
        .where(eq(authenticatedSessions.id, id))
        .limit(1);

      if (!record) {
        return null;
      }

      const now = dependencies.now();
      const absoluteExpiry = Math.min(
        parseTimestamp(record.expiresAt),
        parseTimestamp(record.createdAt) + options.absoluteTimeoutMilliseconds,
      );
      const inactivityExpiry =
        parseTimestamp(record.updatedAt) +
        options.inactivityTimeoutMilliseconds;

      if (
        !Number.isFinite(absoluteExpiry) ||
        !Number.isFinite(inactivityExpiry) ||
        now.getTime() >= absoluteExpiry ||
        now.getTime() >= inactivityExpiry
      ) {
        await database
          .delete(authenticatedSessions)
          .where(eq(authenticatedSessions.id, id));
        return null;
      }

      await database
        .update(authenticatedSessions)
        .set({ updatedAt: now.toISOString() })
        .where(eq(authenticatedSessions.id, id));

      return record.data;
    },

    async update(id, data, expiresAt) {
      const [record] = await database
        .select({ expiresAt: authenticatedSessions.expiresAt })
        .from(authenticatedSessions)
        .where(eq(authenticatedSessions.id, id))
        .limit(1);

      if (!record) {
        return;
      }

      const existingExpiry = parseTimestamp(record.expiresAt);
      const requestedExpiry = expiresAt.getTime();
      const effectiveExpiry = Math.min(existingExpiry, requestedExpiry);

      await database
        .update(authenticatedSessions)
        .set({
          data,
          expiresAt: new Date(effectiveExpiry).toISOString(),
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

function parseTimestamp(value: string) {
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  return Date.parse(normalized);
}
