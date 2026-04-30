-- AlterTable
ALTER TABLE `Card`
  ADD COLUMN `position` INT NULL;

UPDATE `Card` AS `card`
JOIN (
  SELECT
    `ordered`.`id`,
    `ordered`.`new_position`
  FROM (
    SELECT
      `c`.`id`,
      ROW_NUMBER() OVER (
        PARTITION BY `c`.`boardColumnId`
        ORDER BY `c`.`createdAt` ASC, `c`.`id` ASC
      ) AS `new_position`
    FROM `Card` AS `c`
  ) AS `ordered`
) AS `positions`
  ON `positions`.`id` = `card`.`id`
SET `card`.`position` = `positions`.`new_position`;

-- Make position required after backfill.
ALTER TABLE `Card`
  MODIFY `position` INT NOT NULL;

-- Add indexes for stable ordering and uniqueness inside each column.
CREATE INDEX `Card_boardColumnId_position_idx` ON `Card`(`boardColumnId`, `position`);
CREATE UNIQUE INDEX `Card_boardColumnId_position_key` ON `Card`(`boardColumnId`, `position`);
