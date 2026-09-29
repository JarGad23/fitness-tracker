CREATE TABLE `coach_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`model` text,
	`period_start` text,
	`period_end` text,
	`targets` text,
	`applied_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coach_reports_user_created_idx` ON `coach_reports` (`user_id`,`created_at`);