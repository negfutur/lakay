ALTER TABLE `projectBackgroundTasks` ADD `visualReferenceKey` varchar(512);--> statement-breakpoint
ALTER TABLE `projectBackgroundTasks` ADD `visualReferenceMimeType` varchar(32);--> statement-breakpoint
ALTER TABLE `projectBackgroundTasks` ADD `retryOfTaskId` varchar(32);