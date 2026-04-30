-- CreateTable
CREATE TABLE `AiSearchChunk` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `sourceType` ENUM('PROJECT', 'MEETING', 'TRANSCRIPT', 'MEETING_NOTE', 'DECISION', 'TASK', 'CARD', 'CARD_COMMENT', 'FILE') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `summary` LONGTEXT NULL,
    `href` VARCHAR(191) NOT NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiSearchChunk_organizationId_projectId_updatedAt_idx`(`organizationId`, `projectId`, `updatedAt`),
    INDEX `AiSearchChunk_organizationId_sourceType_sourceId_idx`(`organizationId`, `sourceType`, `sourceId`),
    INDEX `AiSearchChunk_projectId_sourceType_updatedAt_idx`(`projectId`, `sourceType`, `updatedAt`),
    FULLTEXT INDEX `AiSearchChunk_title_content_idx`(`title`, `content`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiSearchThread` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `scope` ENUM('ORGANIZATION', 'PROJECT') NOT NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `AiSearchThread_organizationId_userId_status_updatedAt_idx`(`organizationId`, `userId`, `status`, `updatedAt`),
    INDEX `AiSearchThread_organizationId_projectId_status_updatedAt_idx`(`organizationId`, `projectId`, `status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiSearchMessage` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ASSISTANT') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `answerJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiSearchMessage_threadId_createdAt_idx`(`threadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiSearchMessageSource` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('PROJECT', 'MEETING', 'TRANSCRIPT', 'MEETING_NOTE', 'DECISION', 'TASK', 'CARD', 'CARD_COMMENT', 'FILE') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `href` VARCHAR(191) NOT NULL,
    `excerpt` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiSearchMessageSource_messageId_sourceType_sourceId_idx`(`messageId`, `sourceType`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AiSearchChunk` ADD CONSTRAINT `AiSearchChunk_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSearchChunk` ADD CONSTRAINT `AiSearchChunk_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSearchThread` ADD CONSTRAINT `AiSearchThread_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSearchThread` ADD CONSTRAINT `AiSearchThread_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSearchThread` ADD CONSTRAINT `AiSearchThread_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSearchMessage` ADD CONSTRAINT `AiSearchMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `AiSearchThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSearchMessageSource` ADD CONSTRAINT `AiSearchMessageSource_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `AiSearchMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
