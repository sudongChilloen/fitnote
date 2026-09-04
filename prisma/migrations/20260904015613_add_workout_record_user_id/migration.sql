/*
  Warnings:

  - Added the required column `userId` to the `WorkoutRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkoutRecord" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "WorkoutRecord_userId_exerciseId_createdAt_idx" ON "WorkoutRecord"("userId", "exerciseId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "WorkoutRecord" ADD CONSTRAINT "WorkoutRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
