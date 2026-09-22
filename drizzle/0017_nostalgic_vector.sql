ALTER TABLE `user_tokens` MODIFY COLUMN `purpose` enum('email_verification','password_reset') NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `view_count` int DEFAULT 0 NOT NULL;