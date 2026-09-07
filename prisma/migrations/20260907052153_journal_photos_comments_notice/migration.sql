/*
  Warnings:

  - You are about to drop the column `ptSessionId` on the `WorkoutRecord` table. All the data in the column will be lost.
  - You are about to drop the column `recordType` on the `WorkoutRecord` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ptSessionId]` on the table `WorkoutSession` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NoticeScope" AS ENUM ('CENTER', 'TRAINER_MEMBERS');

-- DropForeignKey
ALTER TABLE "WorkoutRecord" DROP CONSTRAINT "WorkoutRecord_ptSessionId_fkey";

-- DropIndex
DROP INDEX "WorkoutRecord_ptSessionId_idx";

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN     "memberReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkoutRecord" DROP COLUMN "ptSessionId",
DROP COLUMN "recordType";

-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN     "ptSessionId" TEXT;

-- DropEnum
DROP TYPE "WorkoutRecordType";

-- CreateTable
CREATE TABLE "JournalPhoto" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalComment" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "authorMembershipId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "JournalComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "authorMembershipId" TEXT NOT NULL,
    "scope" "NoticeScope" NOT NULL DEFAULT 'CENTER',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeRead" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalPhoto_journalId_orderIndex_idx" ON "JournalPhoto"("journalId", "orderIndex");

-- CreateIndex
CREATE INDEX "JournalComment_journalId_createdAt_idx" ON "JournalComment"("journalId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalComment_authorMembershipId_idx" ON "JournalComment"("authorMembershipId");

-- CreateIndex
CREATE INDEX "Notice_centerId_publishedAt_idx" ON "Notice"("centerId", "publishedAt");

-- CreateIndex
CREATE INDEX "Notice_authorMembershipId_idx" ON "Notice"("authorMembershipId");

-- CreateIndex
CREATE INDEX "NoticeRead_membershipId_idx" ON "NoticeRead"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeRead_noticeId_membershipId_key" ON "NoticeRead"("noticeId", "membershipId");

-- CreateIndex
CREATE INDEX "Journal_memberMembershipId_memberReadAt_idx" ON "Journal"("memberMembershipId", "memberReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_ptSessionId_key" ON "WorkoutSession"("ptSessionId");

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_ptSessionId_fkey" FOREIGN KEY ("ptSessionId") REFERENCES "PTSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalPhoto" ADD CONSTRAINT "JournalPhoto_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalComment" ADD CONSTRAINT "JournalComment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalComment" ADD CONSTRAINT "JournalComment_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRead" ADD CONSTRAINT "NoticeRead_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRead" ADD CONSTRAINT "NoticeRead_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CenterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
