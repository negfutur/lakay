CREATE TABLE `projectPreviewShares` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectPreviewShares_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectPreviewShares_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `projectPreviewShares` ADD CONSTRAINT `projectPreviewShares_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectPreviewShares` ADD CONSTRAINT `projectPreviewShares_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_preview_shares_project_active_idx` ON `projectPreviewShares` (`projectId`,`revokedAt`,`expiresAt`);