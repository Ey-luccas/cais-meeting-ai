-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `title` VARCHAR(180) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `type` ENUM(
      'CARD_CREATED',
      'CARD_ASSIGNED',
      'CARD_DUE_DATE_SET',
      'CARD_DUE_SOON',
      'CARD_OVERDUE',
      'CARD_COMMENTED',
      'CARD_MOVED',
      'MEETING_CREATED',
      'MEETING_TRANSCRIPTION_READY',
      'MEETING_NOTES_READY',
      'FILE_UPLOADED',
      'PROJECT_MEMBER_ADDED',
      'SYSTEM'
    ) NOT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'BOTH') NOT NULL,
    `targetType` VARCHAR(120) NULL,
    `targetId` VARCHAR(120) NULL,
    `targetHref` VARCHAR(500) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `emailSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `Notification_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `Notification_organizationId_userId_isRead_createdAt_idx`(`organizationId`, `userId`, `isRead`, `createdAt`),
    INDEX `Notification_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
