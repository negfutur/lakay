CREATE TABLE `creditBalances` (
	`userId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creditBalances_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `creditLedger` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`creditLedgerKind` enum('purchase','usage','adjustment') NOT NULL,
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`operation` varchar(80),
	`stripeCheckoutSessionId` varchar(255),
	`stripePaymentIntentId` varchar(255),
	`sourceEventId` varchar(255),
	`idempotencyKey` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creditLedger_id` PRIMARY KEY(`id`),
	CONSTRAINT `creditLedger_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`),
	CONSTRAINT `creditLedger_stripePaymentIntentId_unique` UNIQUE(`stripePaymentIntentId`),
	CONSTRAINT `creditLedger_sourceEventId_unique` UNIQUE(`sourceEventId`),
	CONSTRAINT `creditLedger_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `creditBalances` ADD CONSTRAINT `creditBalances_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creditLedger` ADD CONSTRAINT `creditLedger_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `credit_ledger_user_created_idx` ON `creditLedger` (`userId`,`createdAt`);