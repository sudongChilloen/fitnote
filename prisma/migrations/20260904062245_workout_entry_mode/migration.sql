-- CreateEnum
CREATE TYPE "WorkoutEntryMode" AS ENUM ('LIVE', 'MANUAL');

-- DropIndex
DROP INDEX "WorkoutSession_userId_status_idx";

-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN     "entryMode" "WorkoutEntryMode" NOT NULL DEFAULT 'LIVE';

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_status_entryMode_idx" ON "WorkoutSession"("userId", "status", "entryMode");
