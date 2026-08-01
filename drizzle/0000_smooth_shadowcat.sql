CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int,
	`entity_type` varchar(50) NOT NULL,
	`entity_id` int NOT NULL,
	`action` varchar(50) NOT NULL,
	`meta` json,
	`created_at` datetime NOT NULL,
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`message` text,
	`source_page` varchar(255),
	`status` enum('new','reviewed','contacted','discarded') NOT NULL DEFAULT 'new',
	`created_at` datetime NOT NULL,
	CONSTRAINT `applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `cities_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`logo_url` varchar(500),
	`whatsapp` varchar(20),
	`website` varchar(500),
	`description` text,
	`owner_user_id` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(255) NOT NULL,
	`company_id` int NOT NULL,
	`category_id` int NOT NULL,
	`city_id` int NOT NULL,
	`contract_type` enum('tiempo_completo','medio_tiempo','temporal','pasantia','freelance') NOT NULL,
	`seniority` enum('sin_experiencia','junior','semi_senior','senior') NOT NULL,
	`modality` enum('presencial','remoto','hibrido') NOT NULL,
	`salary_min` int,
	`salary_max` int,
	`salary_hidden` boolean NOT NULL DEFAULT false,
	`description` text NOT NULL,
	`whatsapp` varchar(20),
	`status` enum('draft','pending','published','rejected','archived') NOT NULL DEFAULT 'draft',
	`featured_until` datetime,
	`published_at` datetime,
	`expires_at` datetime,
	`rejection_reason` text,
	`created_by` int,
	`updated_by` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(200) NOT NULL,
	`role` enum('admin','editor','employer') NOT NULL,
	`company_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `job_created_idx` ON `applications` (`job_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `status_published_at_idx` ON `jobs` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `status_category_city_idx` ON `jobs` (`status`,`category_id`,`city_id`);--> statement-breakpoint
CREATE INDEX `status_featured_until_idx` ON `jobs` (`status`,`featured_until`);