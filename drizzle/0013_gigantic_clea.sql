CREATE TABLE `user_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`purpose` enum('email_verification') NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `user_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `created_via` enum('admin','self_serve') DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` datetime;--> statement-breakpoint
CREATE INDEX `user_purpose_idx` ON `user_tokens` (`user_id`,`purpose`);