CREATE TABLE `post_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`language_code` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `post_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`language_code` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text NOT NULL,
	`translated_content` text,
	`translated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`is_stale` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`original_slug` text NOT NULL,
	`content` text NOT NULL,
	`original_language` text NOT NULL,
	`author_name` text,
	`author_email` text,
	`published_date` text,
	`interaction_count` integer DEFAULT 0,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_original_slug_unique` ON `posts` (`original_slug`);