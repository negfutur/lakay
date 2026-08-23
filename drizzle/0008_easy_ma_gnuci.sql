CREATE TABLE `projectRunnerJobLogs` (
	`id` varchar(32) NOT NULL,
	`jobId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`runnerLogLevel` enum('info','warning','error','success') NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectRunnerJobLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectRunnerJobs` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`runnerJobState` enum('queued','runner_assigned','installing','building','testing','preview_ready','failed','expired','cancelled') NOT NULL DEFAULT 'queued',
	`artifact` json NOT NULL,
	`handoffTokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectRunnerJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectRunnerJobLogs` ADD CONSTRAINT `projectRunnerJobLogs_jobId_projectRunnerJobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `projectRunnerJobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectRunnerJobLogs` ADD CONSTRAINT `projectRunnerJobLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectRunnerJobs` ADD CONSTRAINT `projectRunnerJobs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectRunnerJobs` ADD CONSTRAINT `projectRunnerJobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `runner_job_logs_user_job_created_idx` ON `projectRunnerJobLogs` (`userId`,`jobId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `runner_jobs_user_project_created_idx` ON `projectRunnerJobs` (`userId`,`projectId`,`createdAt`);