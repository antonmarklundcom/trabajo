ALTER TABLE `candidates` ADD `session_version` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` int DEFAULT 0 NOT NULL;