CREATE TABLE `aiGenerationUsage` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`projectId` varchar(32),
	`operation` varchar(80) NOT NULL,
	`provider` varchar(40) NOT NULL,
	`model` varchar(120) NOT NULL,
	`promptTokens` int NOT NULL DEFAULT 0,
	`candidateTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`creditsCharged` int NOT NULL DEFAULT 0,
	`requestId` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiGenerationUsage_id` PRIMARY KEY(`id`),
	CONSTRAINT `aiGenerationUsage_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
ALTER TABLE `aiGenerationUsage` ADD CONSTRAINT `aiGenerationUsage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiGenerationUsage` ADD CONSTRAINT `aiGenerationUsage_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_generation_usage_user_created_idx` ON `aiGenerationUsage` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_generation_usage_project_created_idx` ON `aiGenerationUsage` (`projectId`,`createdAt`);