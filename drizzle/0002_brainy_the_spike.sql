DROP INDEX `acronym_entries_category_idx`;--> statement-breakpoint
ALTER TABLE `acronym_entries` DROP COLUMN `category`;--> statement-breakpoint
ALTER TABLE `acronym_entries` DROP COLUMN `tags`;--> statement-breakpoint
ALTER TABLE `acronym_entries` DROP COLUMN `source`;