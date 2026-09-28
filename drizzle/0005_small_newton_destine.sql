CREATE TABLE `pending_audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`correlation_id` text NOT NULL,
	`event` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_audit_events_correlation_id_idx` ON `pending_audit_events` (`correlation_id`);