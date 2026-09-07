/*
  Warnings:

  - You are about to drop the column `thumbnailUrl` on the `JournalPhoto` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `JournalPhoto` table. All the data in the column will be lost.
  - Added the required column `storagePath` to the `JournalPhoto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "JournalPhoto" DROP COLUMN "thumbnailUrl",
DROP COLUMN "url",
ADD COLUMN     "storagePath" TEXT NOT NULL,
ADD COLUMN     "thumbnailPath" TEXT;
