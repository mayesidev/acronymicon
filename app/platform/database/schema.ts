import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { DefinitionRange } from "../../domain/acronym";

export const acronymEntries = sqliteTable(
  "acronym_entries",
  {
    id: text("id").primaryKey(),
    acronym: text("acronym").notNull(),
    normalizedAcronym: text("normalized_acronym").notNull(),
    variant: integer("variant").notNull().default(1),
    definition: text("definition").notNull(),
    definitionRanges: text("definition_ranges", { mode: "json" })
      .$type<DefinitionRange[]>()
      .notNull()
      .default([]),
    normalizedDefinition: text("normalized_definition").notNull(),
    notes: text("notes"),
    aliases: text("aliases", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    status: text("status", {
      enum: ["pending", "published", "removed"],
    })
      .notNull()
      .default("published"),
    submittedByUserId: text("submitted_by_user_id"),
    submittedByUsername: text("submitted_by_username"),
    submittedByDisplayName: text("submitted_by_display_name"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("acronym_entries_unique_definition").on(
      table.normalizedAcronym,
      table.normalizedDefinition,
    ),
    uniqueIndex("acronym_entries_unique_variant").on(
      table.normalizedAcronym,
      table.variant,
    ),
    index("acronym_entries_acronym_idx").on(table.normalizedAcronym),
    index("acronym_entries_status_idx").on(table.status),
  ],
);

export type AcronymEntry = typeof acronymEntries.$inferSelect;
export type NewAcronymEntry = typeof acronymEntries.$inferInsert;

export const authenticatedSessions = sqliteTable(
  "authenticated_sessions",
  {
    id: text("id").primaryKey(),
    data: text("data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("authenticated_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export type AuthenticatedSession = typeof authenticatedSessions.$inferSelect;
export type NewAuthenticatedSession = typeof authenticatedSessions.$inferInsert;
