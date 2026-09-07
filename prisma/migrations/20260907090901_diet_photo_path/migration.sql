/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `DietRecord` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DietRecord" DROP COLUMN "imageUrl",
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "thumbnailPath" TEXT;
