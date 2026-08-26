CREATE TABLE `localPasswordRecoveryTokens` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `localPasswordRecoveryTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `localPasswordRecoveryTokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `localPasswordRecoveryTokens` ADD CONSTRAINT `localPasswordRecoveryTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `local_recovery_user_expiry_idx` ON `localPasswordRecoveryTokens` (`userId`,`expiresAt`);