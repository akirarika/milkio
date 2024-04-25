CREATE TABLE `devices` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(255),
	CONSTRAINT `devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `name_idx` UNIQUE(`name`)
);
