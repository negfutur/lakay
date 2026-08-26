CREATE TABLE `projectBackgroundTasks` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`kind` varchar(48) NOT NULL DEFAULT 'builder_generate',
	`requestId` varchar(128) NOT NULL,
	`instruction` text NOT NULL,
	`providerInteractionId` varchar(512),
	`providerModel` varchar(120),
	`projectBackgroundTaskStatus` enum('queued','in_progress','requires_action','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`progress` varchar(500) NOT NULL,
	`failureMessage` text,
	`resultSummary` text,
	`resultVersionId` varchar(32),
	`creditsCharged` decimal(12,3) NOT NULL DEFAULT 0,
	`creditOperation` varchar(80),
	`creditIdempotencyKey` varchar(128),
	`cancelledAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectBackgroundTasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectBackgroundTasks_requestId_unique` UNIQUE(`requestId`),
	CONSTRAINT `projectBackgroundTasks_providerInteractionId_unique` UNIQUE(`providerInteractionId`)
);
--> statement-breakpoint
ALTER TABLE `projectBackgroundTasks` ADD CONSTRAINT `projectBackgroundTasks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectBackgroundTasks` ADD CONSTRAINT `projectBackgroundTasks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `background_tasks_user_project_updated_idx` ON `projectBackgroundTasks` (`userId`,`projectId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `background_tasks_provider_interaction_idx` ON `projectBackgroundTasks` (`providerInteractionId`);