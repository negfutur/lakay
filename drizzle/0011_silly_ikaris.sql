CREATE TABLE `projectMobileBranding` (
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`iconKey` varchar(512),
	`iconUrl` varchar(1024),
	`iconFilename` varchar(255),
	`iconWidth` int,
	`iconHeight` int,
	`splashKey` varchar(512),
	`splashUrl` varchar(1024),
	`splashFilename` varchar(255),
	`splashWidth` int,
	`splashHeight` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectMobileBranding_projectId` PRIMARY KEY(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `projectMobileBranding` ADD CONSTRAINT `projectMobileBranding_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectMobileBranding` ADD CONSTRAINT `projectMobileBranding_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mobile_branding_user_project_idx` ON `projectMobileBranding` (`userId`,`projectId`);