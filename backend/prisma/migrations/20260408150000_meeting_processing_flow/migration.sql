-- Normalize legacy statuses before enum change
UPDATE `Meeting` SET `status` = 'PROCESSING_AI' WHERE `status` = 'ANALYZING';
UPDATE `Meeting` SET `status` = 'COMPLETED' WHERE `status` = 'ARCHIVED';

-- Align Meeting status lifecycle with processing pipeline
ALTER TABLE `Meeting`
  MODIFY `status` ENUM('PENDING', 'UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'PROCESSING_AI', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- Allow creating meetings before audio upload
ALTER TABLE `Meeting`
  MODIFY `audioPath` VARCHAR(191) NULL;
