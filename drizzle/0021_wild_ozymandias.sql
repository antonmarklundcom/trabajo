CREATE TABLE `job_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`category_slug` varchar(100),
	`city_slug` varchar(100),
	`token_hash` char(64) NOT NULL,
	`confirmed_at` datetime,
	`confirmation_sent_at` datetime,
	`last_sent_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `job_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_alerts_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `consents` MODIFY COLUMN `subject_type` enum('candidate','employer_user','job_alert') NOT NULL;--> statement-breakpoint
ALTER TABLE `consents` MODIFY COLUMN `purpose` enum('profile_storage','application_share','terms_acceptance','job_alerts') NOT NULL;--> statement-breakpoint
CREATE INDEX `email_idx` ON `job_alerts` (`email`);--> statement-breakpoint
CREATE INDEX `confirmed_sent_idx` ON `job_alerts` (`confirmed_at`,`last_sent_at`);