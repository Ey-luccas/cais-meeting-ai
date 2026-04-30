-- CreateTable
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organization_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationMember` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER') NOT NULL DEFAULT 'MEMBER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrganizationMember_organizationId_idx`(`organizationId`),
    INDEX `OrganizationMember_userId_idx`(`userId`),
    UNIQUE INDEX `OrganizationMember_organizationId_userId_key`(`organizationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Project_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMember` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER') NOT NULL DEFAULT 'MEMBER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectMember_projectId_idx`(`projectId`),
    INDEX `ProjectMember_userId_idx`(`userId`),
    UNIQUE INDEX `ProjectMember_projectId_userId_key`(`projectId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meeting` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `audioPath` VARCHAR(191) NULL,
    `durationSeconds` INTEGER NULL,
    `status` ENUM('PENDING', 'UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'PROCESSING_AI', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Meeting_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `Meeting_createdByUserId_idx`(`createdByUserId`),
    INDEX `Meeting_status_idx`(`status`),
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
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeetingNote` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `summary` LONGTEXT NOT NULL,
    `topicsJson` JSON NULL,
    `decisionsJson` JSON NULL,
    `actionItemsJson` JSON NULL,
    `pendingItemsJson` JSON NULL,
    `commentsJson` JSON NULL,
    `reportJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MeetingNote_meetingId_key`(`meetingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeetingObservation` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `authorUserId` VARCHAR(191) NOT NULL,
    `timestampSeconds` INTEGER NOT NULL,
    `type` ENUM('NOTE', 'TASK', 'QUESTION', 'IMPORTANT', 'DECISION') NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MeetingObservation_meetingId_timestampSeconds_idx`(`meetingId`, `timestampSeconds`),
    INDEX `MeetingObservation_authorUserId_idx`(`authorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectFile` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `uploadedByUserId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectFile_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `ProjectFile_uploadedByUserId_idx`(`uploadedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Board` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Board_projectId_key`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BoardColumn` (
    `id` VARCHAR(191) NOT NULL,
    `boardId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BoardColumn_boardId_idx`(`boardId`),
    UNIQUE INDEX `BoardColumn_boardId_position_key`(`boardId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Card` (
    `id` VARCHAR(191) NOT NULL,
    `boardColumnId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sourceType` ENUM('MANUAL', 'AI') NOT NULL DEFAULT 'MANUAL',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NULL,
    `dueDate` DATETIME(3) NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Card_boardColumnId_idx`(`boardColumnId`),
    INDEX `Card_projectId_boardColumnId_idx`(`projectId`, `boardColumnId`),
    INDEX `Card_meetingId_idx`(`meetingId`),
    INDEX `Card_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardAssignee` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardAssignee_userId_idx`(`userId`),
    UNIQUE INDEX `CardAssignee_cardId_userId_key`(`cardId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardChecklist` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardChecklist_cardId_position_idx`(`cardId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `checklistId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardChecklistItem_checklistId_position_idx`(`checklistId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardComment` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `authorUserId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardComment_cardId_createdAt_idx`(`cardId`, `createdAt`),
    INDEX `CardComment_authorUserId_idx`(`authorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardAttachment_cardId_idx`(`cardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardLink` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardLink_cardId_idx`(`cardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardLabel` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardLabel_projectId_idx`(`projectId`),
    UNIQUE INDEX `CardLabel_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardLabelRelation` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `labelId` VARCHAR(191) NOT NULL,

    INDEX `CardLabelRelation_labelId_idx`(`labelId`),
    UNIQUE INDEX `CardLabelRelation_cardId_labelId_key`(`cardId`, `labelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrganizationMember` ADD CONSTRAINT `OrganizationMember_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationMember` ADD CONSTRAINT `OrganizationMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transcript` ADD CONSTRAINT `Transcript_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingNote` ADD CONSTRAINT `MeetingNote_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingObservation` ADD CONSTRAINT `MeetingObservation_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingObservation` ADD CONSTRAINT `MeetingObservation_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectFile` ADD CONSTRAINT `ProjectFile_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectFile` ADD CONSTRAINT `ProjectFile_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Board` ADD CONSTRAINT `Board_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BoardColumn` ADD CONSTRAINT `BoardColumn_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `Board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_boardColumnId_fkey` FOREIGN KEY (`boardColumnId`) REFERENCES `BoardColumn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardAssignee` ADD CONSTRAINT `CardAssignee_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardAssignee` ADD CONSTRAINT `CardAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardChecklist` ADD CONSTRAINT `CardChecklist_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardChecklistItem` ADD CONSTRAINT `CardChecklistItem_checklistId_fkey` FOREIGN KEY (`checklistId`) REFERENCES `CardChecklist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardComment` ADD CONSTRAINT `CardComment_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardComment` ADD CONSTRAINT `CardComment_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardAttachment` ADD CONSTRAINT `CardAttachment_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardLink` ADD CONSTRAINT `CardLink_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardLabel` ADD CONSTRAINT `CardLabel_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardLabelRelation` ADD CONSTRAINT `CardLabelRelation_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardLabelRelation` ADD CONSTRAINT `CardLabelRelation_labelId_fkey` FOREIGN KEY (`labelId`) REFERENCES `CardLabel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTrigger
CREATE TRIGGER `project_after_insert_create_default_board`
AFTER INSERT ON `Project`
FOR EACH ROW
INSERT INTO `Board` (`id`, `projectId`, `name`, `createdAt`)
VALUES (UUID(), NEW.`id`, 'Board padrão', CURRENT_TIMESTAMP(3));
