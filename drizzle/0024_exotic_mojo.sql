CREATE TABLE `projectAgentActions` (
	`id` varchar(32) NOT NULL,
	`projectId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`projectAgentActionType` enum('clarify','plan','modify','confirm') NOT NULL,
	`projectAgentActionImpact` enum('safe','moderate','high') NOT NULL,
	`instruction` text NOT NULL,
	`summary` text NOT NULL,
	`projectAgentActionStatus` enum('awaiting_confirmation','confirmed','cancelled','executed') NOT NULL DEFAULT 'awaiting_confirmation',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectAgentActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectAgentActions` ADD CONSTRAINT `projectAgentActions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectAgentActions` ADD CONSTRAINT `projectAgentActions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_actions_user_project_status_idx` ON `projectAgentActions` (`userId`,`projectId`,`projectAgentActionStatus`,`updatedAt`);