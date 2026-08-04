ALTER TABLE `acronym_entries` ADD `variant` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
WITH ranked_entries AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_acronym
      ORDER BY created_at, id
    ) AS assigned_variant
  FROM acronym_entries
)
UPDATE acronym_entries
SET variant = (
  SELECT assigned_variant
  FROM ranked_entries
  WHERE ranked_entries.id = acronym_entries.id
);--> statement-breakpoint
CREATE UNIQUE INDEX `acronym_entries_unique_variant` ON `acronym_entries` (`normalized_acronym`,`variant`);
