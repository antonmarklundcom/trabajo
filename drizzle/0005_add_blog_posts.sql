CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` varchar(160) NOT NULL,
	`category` enum('noticias','analisis-laboral','consejos-cv') NOT NULL,
	`body` text NOT NULL,
	`cover_image_key` varchar(255),
	`cover_alt` varchar(255),
	`cover_width` int,
	`cover_height` int,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`related_category` varchar(100),
	`related_city` varchar(100),
	`published_at` datetime,
	`created_by` int,
	`updated_by` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `status_published_at_idx` ON `blog_posts` (`status`,`published_at`);