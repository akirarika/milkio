CREATE TABLE `groups` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(255),
	CONSTRAINT `groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users_to_groups` (
	`user_id` bigint NOT NULL,
	`group_id` bigint NOT NULL,
	CONSTRAINT `users_to_groups_user_id_group_id_pk` PRIMARY KEY(`user_id`,`group_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(255),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `name_idx` UNIQUE(`name`)
);
