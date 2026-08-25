CREATE TABLE `projectMobileBuildAuthorizations` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`mobileBuildAuthorizationStatus` enum('simulated_paid','stripe_paid','revoked') NOT NULL,
	`amountUsdCents` int NOT NULL DEFAULT 700,
	`providerReference` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectMobileBuildAuthorizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectMobileBuildAuthorizations_providerReference_unique` UNIQUE(`providerReference`),
	CONSTRAINT `mobile_build_authorization_user_project_unique` UNIQUE(`userId`,`projectId`)
);
--> statement-breakpoint
ALTER TABLE `projectMobileBuildAuthorizations` ADD CONSTRAINT `projectMobileBuildAuthorizations_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectMobileBuildAuthorizations` ADD CONSTRAINT `projectMobileBuildAuthorizations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mobile_build_authorization_project_idx` ON `projectMobileBuildAuthorizations` (`projectId`);