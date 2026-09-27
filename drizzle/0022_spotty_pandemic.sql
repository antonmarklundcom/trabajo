CREATE TABLE `plan_prices` (
	`plan_key` varchar(32) NOT NULL,
	`price_gs` int NOT NULL,
	`promo_price_gs` int,
	`promo_ends_at` datetime,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `plan_prices_plan_key` PRIMARY KEY(`plan_key`)
);
