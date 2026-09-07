-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN     "recordedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "WorkoutSession_recordedByUserId_startedAt_idx" ON "WorkoutSession"("recordedByUserId", "startedAt");

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
