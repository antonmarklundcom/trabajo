CREATE TABLE `job_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`image_key` varchar(255) NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `job_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `job_sort_idx` ON `job_images` (`job_id`,`sort_order`);