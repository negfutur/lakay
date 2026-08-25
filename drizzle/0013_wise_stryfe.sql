ALTER TABLE `aiGenerationUsage` MODIFY COLUMN `creditsCharged` decimal(12,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `creditBalances` MODIFY COLUMN `balance` decimal(12,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `creditLedger` MODIFY COLUMN `amount` decimal(12,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `creditLedger` MODIFY COLUMN `balanceAfter` decimal(12,3) NOT NULL;