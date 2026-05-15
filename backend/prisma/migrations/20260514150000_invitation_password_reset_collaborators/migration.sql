-- CreateTable
CREATE TABLE `Invitation` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(128) NOT NULL,
  `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER') NOT NULL DEFAULT 'MEMBER',
  `invitedByUserId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `acceptedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX `Invitation_organizationId_email_idx`(`organizationId`, `email`),
  INDEX `Invitation_tokenHash_idx`(`tokenHash`),
  INDEX `Invitation_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvitationProject` (
  `id` VARCHAR(191) NOT NULL,
  `invitationId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER') NOT NULL DEFAULT 'MEMBER',

  UNIQUE INDEX `InvitationProject_invitationId_projectId_key`(`invitationId`, `projectId`),
  INDEX `InvitationProject_projectId_idx`(`projectId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(128) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `PasswordResetToken_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `PasswordResetToken_tokenHash_idx`(`tokenHash`),
  INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_invitedByUserId_fkey`
  FOREIGN KEY (`invitedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvitationProject` ADD CONSTRAINT `InvitationProject_invitationId_fkey`
  FOREIGN KEY (`invitationId`) REFERENCES `Invitation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `InvitationProject` ADD CONSTRAINT `InvitationProject_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
