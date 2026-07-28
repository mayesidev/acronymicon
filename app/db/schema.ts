import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const acronymEntries = sqliteTable(
  "acronym_entries",
  {
    id: text("id").primaryKey(),
    acronym: text("acronym").notNull(),
    normalizedAcronym: text("normalized_acronym").notNull(),
    definition: text("definition").notNull(),
    normalizedDefinition: text("normalized_definition").notNull(),
    notes: text("notes"),
    category: text("category"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    aliases: text("aliases", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    source: text("source"),
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
    index("acronym_entries_acronym_idx").on(table.normalizedAcronym),
    index("acronym_entries_status_idx").on(table.status),
    index("acronym_entries_category_idx").on(table.category),
  ],
);

export type AcronymEntry = typeof acronymEntries.$inferSelect;
export type NewAcronymEntry = typeof acronymEntries.$inferInsert;
