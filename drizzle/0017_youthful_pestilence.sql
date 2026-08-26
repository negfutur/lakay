DROP INDEX `project_messages_project_created_idx` ON `projectMessages`;--> statement-breakpoint
ALTER TABLE `projectMessages` ADD `sequence` int NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE INDEX `project_messages_project_sequence_idx` ON `projectMessages` (`projectId`,`sequence`);
