CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`email` varchar(320),
	`message` text NOT NULL,
	`source_page` varchar(300),
	`created_at` datetime NOT NULL,
	`handled_at` datetime,
	`handled_by_user_id` int,
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `created_idx` ON `contact_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `handled_created_idx` ON `contact_messages` (`handled_at`,`created_at`);