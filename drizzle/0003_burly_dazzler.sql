CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` varchar(160) NOT NULL,
	`category` enum('noticias','analisis-laboral','consejos-cv') NOT NULL,
	`body_html` text NOT NULL,
	`featured_image_key` varchar(255),
	`image_keys` json NOT NULL DEFAULT ('[]'),
	`related_category` varchar(255),
	`related_city` varchar(255),
	`published` boolean NOT NULL DEFAULT false,
	`published_at` datetime,
	`created_by` int,
	`updated_by` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `published_at_idx` ON `blog_posts` (`published`,`published_at`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `blog_posts` (`category`);