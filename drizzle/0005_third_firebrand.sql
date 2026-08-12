CREATE TABLE `blog_post_redirects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_slug` varchar(200) NOT NULL,
	`post_id` int NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `blog_post_redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_post_redirects_from_slug_unique` UNIQUE(`from_slug`)
);
--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` varchar(300) NOT NULL,
	`body` text NOT NULL,
	`category` enum('noticias','analisis-laboral','consejos-cv') NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`cover_image_key` varchar(255),
	`cover_alt` varchar(200),
	`related_category_slug` varchar(100),
	`related_city_slug` varchar(100),
	`published_at` date,
	`author_user_id` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `post_idx` ON `blog_post_redirects` (`post_id`);--> statement-breakpoint
CREATE INDEX `status_published_idx` ON `blog_posts` (`status`,`published_at`);