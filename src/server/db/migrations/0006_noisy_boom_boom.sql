ALTER TABLE `conversations` ADD `forked_from_conversation_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `forked_from_message_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `forked_at` integer;