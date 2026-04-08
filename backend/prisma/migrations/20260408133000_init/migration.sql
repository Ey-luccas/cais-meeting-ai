-- CreateTable
CREATE TABLE `Meeting` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `audioPath` VARCHAR(191) NOT NULL,
    `durationSeconds` INTEGER NULL,
    `status` ENUM('UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'ANALYZING', 'COMPLETED', 'FAILED', 'ARCHIVED') NOT NULL DEFAULT 'UPLOADED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Meeting_status_idx`(`status`),
    INDEX `Meeting_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transcript` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `fullText` LONGTEXT NOT NULL,
    `language` VARCHAR(191) NULL,
    `rawJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Transcript_meetingId_key`(`meetingId`),
    INDEX `Transcript_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Note` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `summary` LONGTEXT NOT NULL,
    `topicsJson` JSON NOT NULL,
    `decisionsJson` JSON NOT NULL,
    `actionItemsJson` JSON NOT NULL,
    `pendingItemsJson` JSON NOT NULL,
    `commentsJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Note_meetingId_key`(`meetingId`),
    INDEX `Note_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeetingTag` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,

    INDEX `MeetingTag_meetingId_idx`(`meetingId`),
    INDEX `MeetingTag_tag_idx`(`tag`),
    UNIQUE INDEX `MeetingTag_meetingId_tag_key`(`meetingId`, `tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Transcript` ADD CONSTRAINT `Transcript_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingTag` ADD CONSTRAINT `MeetingTag_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

