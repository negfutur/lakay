CREATE TABLE `projectMessages` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`messageRole` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`projectStatus` enum('draft','generating','ready') NOT NULL DEFAULT 'draft',
	`generatedPlan` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectMessages` ADD CONSTRAINT `projectMessages_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectMessages` ADD CONSTRAINT `projectMessages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_messages_project_created_idx` ON `projectMessages` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `projects_user_created_idx` ON `projects` (`userId`,`createdAt`);