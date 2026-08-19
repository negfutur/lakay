CREATE TABLE `projectBuildVersions` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`instruction` text,
	`builderVersionOrigin` enum('generate','restore') NOT NULL,
	`files` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectBuildVersions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectFiles` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`path` varchar(180) NOT NULL,
	`builderFileLanguage` enum('html','css','javascript') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectFiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_files_project_path_unique` UNIQUE(`projectId`,`path`)
);
--> statement-breakpoint
ALTER TABLE `projectBuildVersions` ADD CONSTRAINT `projectBuildVersions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectBuildVersions` ADD CONSTRAINT `projectBuildVersions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectFiles` ADD CONSTRAINT `projectFiles_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectFiles` ADD CONSTRAINT `projectFiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_build_versions_user_project_idx` ON `projectBuildVersions` (`userId`,`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `project_files_user_project_idx` ON `projectFiles` (`userId`,`projectId`);