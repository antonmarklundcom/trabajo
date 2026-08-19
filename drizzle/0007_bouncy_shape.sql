CREATE TABLE `candidate_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidate_id` int NOT NULL,
	`purpose` enum('email_verification','password_reset') NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `candidate_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `candidate_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `candidate_purpose_idx` ON `candidate_tokens` (`candidate_id`,`purpose`);