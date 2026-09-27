ALTER TABLE `companies` ADD `notify_weekly_digest` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `last_digest_sent_at` datetime;--> statement-breakpoint
ALTER TABLE `jobs` ADD `view_count_at_digest` int DEFAULT 0 NOT NULL;