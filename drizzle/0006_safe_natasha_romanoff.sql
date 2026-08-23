CREATE TABLE `projectRunnerProfiles` (
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`runnerExecutionMode` enum('static','full_stack_runner') NOT NULL DEFAULT 'static',
	`runnerProfileStatus` enum('static_preview_ready','runner_required','runner_connected','build_queued','build_failed') NOT NULL DEFAULT 'static_preview_ready',
	`manifest` json,
	`diagnostics` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectRunnerProfiles_projectId` PRIMARY KEY(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `projectRunnerProfiles` ADD CONSTRAINT `projectRunnerProfiles_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectRunnerProfiles` ADD CONSTRAINT `projectRunnerProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `runner_profiles_user_project_idx` ON `projectRunnerProfiles` (`userId`,`projectId`);