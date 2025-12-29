CREATE TABLE `shared_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_input` text NOT NULL,
	`response` text NOT NULL,
	`model_id` text,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
