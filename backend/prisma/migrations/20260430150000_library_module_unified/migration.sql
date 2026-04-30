-- AlterTable
ALTER TABLE `AiSearchChunk`
  MODIFY `sourceType` ENUM(
    'PROJECT',
    'MEETING',
    'TRANSCRIPT',
    'MEETING_NOTE',
    'DECISION',
    'TASK',
    'CARD',
    'CARD_COMMENT',
    'FILE',
    'LIBRARY_ITEM'
  ) NOT NULL;

-- AlterTable
ALTER TABLE `AiSearchMessageSource`
  MODIFY `sourceType` ENUM(
    'PROJECT',
    'MEETING',
    'TRANSCRIPT',
    'MEETING_NOTE',
    'DECISION',
    'TASK',
    'CARD',
    'CARD_COMMENT',
    'FILE',
    'LIBRARY_ITEM'
  ) NOT NULL;

-- CreateTable
CREATE TABLE `LibraryFolder` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `parentId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX `LibraryFolder_projectId_parentId_name_idx`(`projectId`, `parentId`, `name`),
  INDEX `LibraryFolder_parentId_idx`(`parentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LibraryItem` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `folderId` VARCHAR(191) NULL,
  `meetingId` VARCHAR(191) NULL,
  `projectFileId` VARCHAR(191) NULL,
  `title` VARCHAR(240) NOT NULL,
  `description` VARCHAR(1000) NULL,
  `type` ENUM('DOCUMENT', 'FILE') NOT NULL,
  `origin` ENUM('MANUAL', 'AI', 'MEETING', 'UPLOAD') NOT NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `documentType` ENUM(
    'MEETING_MINUTES',
    'SCOPE',
    'REQUIREMENTS',
    'PLANNING',
    'PROPOSAL',
    'TECHNICAL',
    'MANUAL',
    'DECISION_RECORD',
    'ACTION_PLAN',
    'OTHER'
  ) NULL,
  `filePath` VARCHAR(500) NULL,
  `fileName` VARCHAR(255) NULL,
  `mimeType` VARCHAR(180) NULL,
  `sizeBytes` INTEGER NULL,
  `contentMarkdown` LONGTEXT NULL,
  `contentText` LONGTEXT NULL,
  `contentJson` JSON NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `updatedByUserId` VARCHAR(191) NULL,
  `archivedAt` DATETIME(3) NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX `LibraryItem_projectId_deletedAt_updatedAt_idx`(`projectId`, `deletedAt`, `updatedAt`),
  INDEX `LibraryItem_projectId_type_status_updatedAt_idx`(`projectId`, `type`, `status`, `updatedAt`),
  INDEX `LibraryItem_projectId_origin_status_updatedAt_idx`(`projectId`, `origin`, `status`, `updatedAt`),
  INDEX `LibraryItem_projectId_folderId_updatedAt_idx`(`projectId`, `folderId`, `updatedAt`),
  INDEX `LibraryItem_meetingId_idx`(`meetingId`),
  INDEX `LibraryItem_projectFileId_idx`(`projectFileId`),
  INDEX `LibraryItem_title_idx`(`title`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LibraryTag` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `color` VARCHAR(20) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `LibraryTag_projectId_name_key`(`projectId`, `name`),
  INDEX `LibraryTag_projectId_createdAt_idx`(`projectId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LibraryItemTag` (
  `id` VARCHAR(191) NOT NULL,
  `libraryItemId` VARCHAR(191) NOT NULL,
  `tagId` VARCHAR(191) NOT NULL,

  UNIQUE INDEX `LibraryItemTag_libraryItemId_tagId_key`(`libraryItemId`, `tagId`),
  INDEX `LibraryItemTag_tagId_idx`(`tagId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LibraryItemVersion` (
  `id` VARCHAR(191) NOT NULL,
  `libraryItemId` VARCHAR(191) NOT NULL,
  `contentMarkdown` LONGTEXT NULL,
  `contentText` LONGTEXT NULL,
  `contentJson` JSON NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `LibraryItemVersion_libraryItemId_createdAt_idx`(`libraryItemId`, `createdAt`),
  INDEX `LibraryItemVersion_createdByUserId_idx`(`createdByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LibraryFolder` ADD CONSTRAINT `LibraryFolder_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LibraryFolder` ADD CONSTRAINT `LibraryFolder_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `LibraryFolder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LibraryItem` ADD CONSTRAINT `LibraryItem_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LibraryItem` ADD CONSTRAINT `LibraryItem_folderId_fkey`
  FOREIGN KEY (`folderId`) REFERENCES `LibraryFolder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LibraryItem` ADD CONSTRAINT `LibraryItem_meetingId_fkey`
  FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LibraryItem` ADD CONSTRAINT `LibraryItem_projectFileId_fkey`
  FOREIGN KEY (`projectFileId`) REFERENCES `ProjectFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LibraryItem` ADD CONSTRAINT `LibraryItem_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LibraryItem` ADD CONSTRAINT `LibraryItem_updatedByUserId_fkey`
  FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LibraryTag` ADD CONSTRAINT `LibraryTag_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LibraryItemTag` ADD CONSTRAINT `LibraryItemTag_libraryItemId_fkey`
  FOREIGN KEY (`libraryItemId`) REFERENCES `LibraryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LibraryItemTag` ADD CONSTRAINT `LibraryItemTag_tagId_fkey`
  FOREIGN KEY (`tagId`) REFERENCES `LibraryTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LibraryItemVersion` ADD CONSTRAINT `LibraryItemVersion_libraryItemId_fkey`
  FOREIGN KEY (`libraryItemId`) REFERENCES `LibraryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LibraryItemVersion` ADD CONSTRAINT `LibraryItemVersion_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: transforma uploads já existentes em itens da biblioteca
INSERT INTO `LibraryItem` (
  `id`,
  `projectId`,
  `folderId`,
  `meetingId`,
  `projectFileId`,
  `title`,
  `description`,
  `type`,
  `origin`,
  `status`,
  `documentType`,
  `filePath`,
  `fileName`,
  `mimeType`,
  `sizeBytes`,
  `contentMarkdown`,
  `contentText`,
  `contentJson`,
  `createdByUserId`,
  `updatedByUserId`,
  `archivedAt`,
  `deletedAt`,
  `createdAt`,
  `updatedAt`
)
SELECT
  UUID(),
  pf.`projectId`,
  NULL,
  NULL,
  pf.`id`,
  pf.`name`,
  pf.`description`,
  'FILE',
  'UPLOAD',
  'PUBLISHED',
  NULL,
  pf.`filePath`,
  pf.`name`,
  pf.`mimeType`,
  pf.`sizeBytes`,
  NULL,
  NULL,
  NULL,
  pf.`uploadedByUserId`,
  pf.`uploadedByUserId`,
  NULL,
  NULL,
  pf.`createdAt`,
  pf.`createdAt`
FROM `ProjectFile` pf
LEFT JOIN `LibraryItem` li ON li.`projectFileId` = pf.`id`
WHERE li.`id` IS NULL;
