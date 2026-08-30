CREATE TABLE `feature_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`company_id` int NOT NULL,
	`days` int NOT NULL,
	`amount_gs` int NOT NULL,
	`status` enum('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
	`processor` enum('pagopar','bancard') NOT NULL,
	`processor_order_id` varchar(191) NOT NULL,
	`paid_at` datetime,
	`fulfilled_at` datetime,
	`featured_until` datetime,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `feature_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `feature_orders_processor_order_id_unique` UNIQUE(`processor_order_id`)
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int,
	`processor` enum('pagopar','bancard') NOT NULL,
	`signature_valid` boolean NOT NULL,
	`payload` json NOT NULL,
	`received_at` datetime NOT NULL,
	`ip` varchar(45),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `company_created_idx` ON `feature_orders` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `job_created_idx` ON `feature_orders` (`job_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `status_created_idx` ON `feature_orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_received_idx` ON `payment_events` (`order_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `processor_received_idx` ON `payment_events` (`processor`,`received_at`);