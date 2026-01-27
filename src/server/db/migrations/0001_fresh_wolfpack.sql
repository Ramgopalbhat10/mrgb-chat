ALTER TABLE `sessions` RENAME TO `session`;--> statement-breakpoint
ALTER TABLE `users` RENAME TO `user`;--> statement-breakpoint
ALTER TABLE `session` RENAME COLUMN "token_hash" TO "token";--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_session`("id", "user_id", "token", "expires_at", "ip_address", "user_agent", "created_at", "updated_at") SELECT "id", "user_id", "token", "expires_at", "ip_address", "user_agent", "created_at", "updated_at" FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
DROP INDEX IF EXISTS `users_github_user_id_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS "session_token_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "user_email_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "web_documents_canonical_url_unique";--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "email" TO "email" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `web_documents_canonical_url_unique` ON `web_documents` (`canonical_url`);--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "name" TO "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `email_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `image` text;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `github_user_id`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `avatar_url`;
