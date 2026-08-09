CREATE TABLE `candidate_cvs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidate_id` int NOT NULL,
	`storage_key` varchar(255) NOT NULL,
	`original_filename` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size_bytes` int NOT NULL,
	`is_current` boolean NOT NULL DEFAULT true,
	`uploaded_at` datetime NOT NULL,
	`deleted_at` datetime,
	CONSTRAINT `candidate_cvs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidate_experiences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidate_id` int NOT NULL,
	`company_name` varchar(200) NOT NULL,
	`title` varchar(200) NOT NULL,
	`start_month` date NOT NULL,
	`end_month` date,
	`is_current` boolean NOT NULL DEFAULT false,
	`description` text,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `candidate_experiences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`city_id` int,
	`headline` varchar(200),
	`is_active` boolean NOT NULL DEFAULT true,
	`email_verified_at` datetime,
	`last_login_at` datetime,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `candidates_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `consents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject_type` enum('candidate','employer_user') NOT NULL,
	`subject_id` int NOT NULL,
	`purpose` enum('profile_storage','application_share','terms_acceptance') NOT NULL,
	`granted` boolean NOT NULL,
	`policy_version` varchar(20) NOT NULL,
	`related_company_id` int,
	`related_job_id` int,
	`ip` varchar(45),
	`user_agent` varchar(255),
	`created_at` datetime NOT NULL,
	CONSTRAINT `consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_access_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int NOT NULL,
	`actor_role` varchar(20) NOT NULL,
	`action` enum('list_candidates','view_candidate','view_cv','view_application','export') NOT NULL,
	`subject_type` varchar(30) NOT NULL,
	`subject_id` int NOT NULL,
	`reason` varchar(255),
	`ip` varchar(45),
	`created_at` datetime NOT NULL,
	CONSTRAINT `data_access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deletion_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidate_id` int NOT NULL,
	`email_hash` varchar(64) NOT NULL,
	`requested_by` enum('candidate','admin') NOT NULL,
	`actor_user_id` int,
	`requested_at` datetime NOT NULL,
	`executed_at` datetime,
	`outcome` text,
	CONSTRAINT `deletion_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employer_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`created_by` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`accepted_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `employer_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `employer_invitations_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `applications` MODIFY COLUMN `name` varchar(200);--> statement-breakpoint
ALTER TABLE `applications` MODIFY COLUMN `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `applications` MODIFY COLUMN `status` enum('new','reviewed','contacted','discarded','hired') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `applications` ADD `candidate_id` int;--> statement-breakpoint
ALTER TABLE `applications` ADD `consent_id` int;--> statement-breakpoint
ALTER TABLE `applications` ADD `cv_id` int;--> statement-breakpoint
ALTER TABLE `applications` ADD `redacted_at` datetime;--> statement-breakpoint
ALTER TABLE `applications` ADD `status_changed_at` datetime;--> statement-breakpoint
ALTER TABLE `applications` ADD `status_changed_by` int;--> statement-breakpoint
CREATE INDEX `candidate_current_idx` ON `candidate_cvs` (`candidate_id`,`is_current`);--> statement-breakpoint
CREATE INDEX `candidate_sort_idx` ON `candidate_experiences` (`candidate_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `subject_purpose_idx` ON `consents` (`subject_type`,`subject_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `related_company_idx` ON `consents` (`related_company_id`);--> statement-breakpoint
CREATE INDEX `subject_created_idx` ON `data_access_logs` (`subject_type`,`subject_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `actor_created_idx` ON `data_access_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `company_created_idx` ON `employer_invitations` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `candidate_created_idx` ON `applications` (`candidate_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `company_status_created_idx` ON `jobs` (`company_id`,`status`,`created_at`);