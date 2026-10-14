CREATE TABLE `plan_checklist` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`section` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_checklist_plan_idx` ON `plan_checklist` (`plan_id`);--> statement-breakpoint
CREATE TABLE `plan_days` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`label` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_days_plan_idx` ON `plan_days` (`plan_id`);--> statement-breakpoint
CREATE TABLE `plan_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_day_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`sets` integer NOT NULL,
	`rep_min` integer NOT NULL,
	`rep_max` integer NOT NULL,
	`superset` integer,
	`alternative` text,
	`tips` text,
	FOREIGN KEY (`plan_day_id`) REFERENCES `plan_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_exercises_day_idx` ON `plan_exercises` (`plan_day_id`);--> statement-breakpoint
CREATE TABLE `training_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_plans_user_idx` ON `training_plans` (`user_id`);--> statement-breakpoint
ALTER TABLE `exercises` ADD `unit` text DEFAULT 'reps' NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `plan_day_id` text REFERENCES plan_days(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `workouts` ADD `plan_checks` text;