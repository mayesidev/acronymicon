CREATE TABLE `acronym_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`acronym` text NOT NULL,
	`normalized_acronym` text NOT NULL,
	`definition` text NOT NULL,
	`normalized_definition` text NOT NULL,
	`notes` text,
	`category` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`source` text,
	`status` text DEFAULT 'published' NOT NULL,
	`submitted_by_user_id` text,
	`submitted_by_username` text,
	`submitted_by_display_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `acronym_entries_unique_definition` ON `acronym_entries` (`normalized_acronym`,`normalized_definition`);--> statement-breakpoint
CREATE INDEX `acronym_entries_acronym_idx` ON `acronym_entries` (`normalized_acronym`);--> statement-breakpoint
CREATE INDEX `acronym_entries_status_idx` ON `acronym_entries` (`status`);--> statement-breakpoint
CREATE INDEX `acronym_entries_category_idx` ON `acronym_entries` (`category`);