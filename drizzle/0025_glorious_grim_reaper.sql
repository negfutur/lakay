CREATE TABLE `externalAuthIdentities` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(32) NOT NULL,
	`providerSubject` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `externalAuthIdentities_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_auth_provider_subject_unique` UNIQUE(`provider`,`providerSubject`)
);
--> statement-breakpoint
ALTER TABLE `externalAuthIdentities` ADD CONSTRAINT `externalAuthIdentities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `external_auth_user_idx` ON `externalAuthIdentities` (`userId`);