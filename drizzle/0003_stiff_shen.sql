ALTER TABLE `projectBuildVersions` MODIFY COLUMN `builderVersionOrigin` enum('generate','restore','edit') NOT NULL;
