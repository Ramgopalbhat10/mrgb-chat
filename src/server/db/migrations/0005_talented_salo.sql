ALTER TABLE `conversations` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shared_messages` ADD `original_message_id` text;--> statement-breakpoint
ALTER TABLE `shared_messages` ADD `conversation_id` text;