CREATE TABLE `ai_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_usd` real,
	`ok` integer NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_calls_user_created_idx` ON `ai_calls` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `coach_brief` text;