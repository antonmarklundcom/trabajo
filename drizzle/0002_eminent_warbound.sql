CREATE TABLE `saved_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidate_id` int NOT NULL,
	`job_id` int NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `saved_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `candidate_job_unique_idx` UNIQUE(`candidate_id`,`job_id`)
);
--> statement-breakpoint
CREATE INDEX `candidate_created_idx` ON `saved_jobs` (`candidate_id`,`created_at`);