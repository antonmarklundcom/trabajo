CREATE TABLE `auth_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surface` enum('admin','empresa','postulante') NOT NULL,
	`user_id` int,
	`candidate_id` int,
	`event` enum('login_ok','login_fail','logout','password_change','password_reset_request','password_reset_ok') NOT NULL,
	`identifier_hint` varchar(64),
	`ip` varchar(45),
	`created_at` datetime NOT NULL,
	CONSTRAINT `auth_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `surface_created_idx` ON `auth_events` (`surface`,`created_at`);