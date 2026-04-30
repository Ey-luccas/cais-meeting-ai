-- AlterTable
ALTER TABLE `CardChecklist`
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `CardChecklistItem`
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `CardLink`
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `CardAttachment`
  ADD COLUMN `uploadedByUserId` VARCHAR(191) NULL,
  ADD COLUMN `projectFileId` VARCHAR(191) NULL;

UPDATE `CardAttachment` AS `attachment`
INNER JOIN `Card` AS `card` ON `card`.`id` = `attachment`.`cardId`
SET `attachment`.`uploadedByUserId` = `card`.`createdByUserId`
WHERE `attachment`.`uploadedByUserId` IS NULL;

ALTER TABLE `CardAttachment`
  MODIFY `uploadedByUserId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `CardActivity` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `type` ENUM(
      'CARD_CREATED',
      'CARD_UPDATED',
      'CARD_MOVED',
      'CARD_DELETED',
      'ASSIGNEE_ADDED',
      'ASSIGNEE_REMOVED',
      'DUE_DATE_UPDATED',
      'PRIORITY_UPDATED',
      'CHECKLIST_CREATED',
      'CHECKLIST_UPDATED',
      'CHECKLIST_REMOVED',
      'CHECKLIST_ITEM_CREATED',
      'CHECKLIST_ITEM_UPDATED',
      'CHECKLIST_ITEM_TOGGLED',
      'CHECKLIST_ITEM_REMOVED',
      'COMMENT_ADDED',
      'LINK_ADDED',
      'LINK_UPDATED',
      'LINK_REMOVED',
      'ATTACHMENT_ADDED',
      'ATTACHMENT_REMOVED',
      'LABEL_CREATED',
      'LABEL_UPDATED',
      'LABEL_REMOVED'
    ) NOT NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardActivity_cardId_createdAt_idx`(`cardId`, `createdAt`),
    INDEX `CardActivity_actorUserId_idx`(`actorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CardAttachment_uploadedByUserId_idx` ON `CardAttachment`(`uploadedByUserId`);
CREATE INDEX `CardAttachment_projectFileId_idx` ON `CardAttachment`(`projectFileId`);

-- AddForeignKey
ALTER TABLE `CardAttachment` ADD CONSTRAINT `CardAttachment_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CardAttachment` ADD CONSTRAINT `CardAttachment_projectFileId_fkey` FOREIGN KEY (`projectFileId`) REFERENCES `ProjectFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CardActivity` ADD CONSTRAINT `CardActivity_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CardActivity` ADD CONSTRAINT `CardActivity_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
