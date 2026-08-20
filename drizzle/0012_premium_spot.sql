CREATE TABLE `ops_state` (
	`state_key` varchar(64) NOT NULL,
	`value` varchar(255) NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `ops_state_state_key` PRIMARY KEY(`state_key`)
);
