CREATE TABLE `projectDomains` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`hostname` varchar(253) NOT NULL,
	`registrar` varchar(32) NOT NULL DEFAULT 'namecom',
	`projectDomainStatus` enum('awaiting_connection','dns_instructions_ready','verifying','live','error') NOT NULL DEFAULT 'awaiting_connection',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectDomains_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectDomains_projectId_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `projectDomains` ADD CONSTRAINT `projectDomains_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectDomains` ADD CONSTRAINT `projectDomains_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_domains_user_project_idx` ON `projectDomains` (`userId`,`projectId`);