CREATE TABLE `projectMessageSequences` (
	`projectId` varchar(32) NOT NULL,
	`nextSequence` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectMessageSequences_projectId` PRIMARY KEY(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `projectMessageSequences` ADD CONSTRAINT `projectMessageSequences_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;
