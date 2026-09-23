CREATE TABLE `favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`team_name` text NOT NULL,
	`league` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorites_user_team` ON `favorites` (`user_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `idx_favorites_user` ON `favorites` (`user_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`game_label` text NOT NULL,
	`mood` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_user_created` ON `reviews` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`game_date` text NOT NULL,
	`league` text NOT NULL,
	`away_team` text NOT NULL,
	`home_team` text NOT NULL,
	`ballpark` text NOT NULL,
	`seat` text DEFAULT '' NOT NULL,
	`score` text DEFAULT '' NOT NULL,
	`result` text NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visits_user_date` ON `visits` (`user_id`,`game_date`);--> statement-breakpoint
PRAGMA optimize;
