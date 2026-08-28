CREATE TABLE `userAiRequestLocks` (
	`userId` int NOT NULL,
	`requestId` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userAiRequestLocks_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `userAiRequestLocks` ADD CONSTRAINT `userAiRequestLocks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;