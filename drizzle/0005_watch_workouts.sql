ALTER TABLE `activity_types` ADD `health_kind` text;--> statement-breakpoint
ALTER TABLE `health_metrics` ADD `exercise_minutes` integer;--> statement-breakpoint
ALTER TABLE `health_metrics` ADD `cycling_km` real;--> statement-breakpoint
ALTER TABLE `health_metrics` ADD `swimming_m` integer;--> statement-breakpoint
ALTER TABLE `health_metrics` ADD `running_speed_kmh` real;--> statement-breakpoint
ALTER TABLE `workouts` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
-- Link existing activities to Apple Watch signals by their default Polish names.
UPDATE `activity_types` SET `health_kind` = 'cycling' WHERE lower(trim(`name`)) = 'rower';--> statement-breakpoint
UPDATE `activity_types` SET `health_kind` = 'swimming' WHERE lower(trim(`name`)) = 'basen';--> statement-breakpoint
UPDATE `activity_types` SET `health_kind` = 'running' WHERE lower(trim(`name`)) = 'bieganie';
