CREATE TABLE `localAuthAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`passwordUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localAuthAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `localAuthAccounts_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `localAuthAccounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `localAuthAccounts` ADD CONSTRAINT `localAuthAccounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;