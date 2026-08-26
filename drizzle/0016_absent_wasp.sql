CREATE TABLE `adminCreditPackageDrafts` (
	`id` varchar(32) NOT NULL,
	`label` varchar(120) NOT NULL,
	`credits` decimal(12,3) NOT NULL,
	`stripePriceId` varchar(255),
	`adminCreditPackageDraftStatus` enum('draft','approved') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adminCreditPackageDrafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `adminCreditPackageDrafts` ADD CONSTRAINT `adminCreditPackageDrafts_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_credit_package_drafts_updated_idx` ON `adminCreditPackageDrafts` (`updatedAt`);