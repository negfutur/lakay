CREATE TABLE `projectInitialVisualReferences` (
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`key` varchar(512) NOT NULL,
	`mimeType` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectInitialVisualReferences_projectId` PRIMARY KEY(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `projectInitialVisualReferences` ADD CONSTRAINT `projectInitialVisualReferences_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectInitialVisualReferences` ADD CONSTRAINT `projectInitialVisualReferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `initial_visual_reference_user_project_idx` ON `projectInitialVisualReferences` (`userId`,`projectId`);