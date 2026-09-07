/*
  Warnings:

  - You are about to drop the column `acceptedAt` on the `CenterInvitation` table. All the data in the column will be lost.
  - Added the required column `createdByMembershipId` to the `CenterInvitation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CenterInvitation" DROP COLUMN "acceptedAt",
ADD COLUMN     "createdByMembershipId" TEXT NOT NULL,
ADD COLUMN     "maxUses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "usedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CenterMembership" ADD COLUMN     "joinedViaInvitationId" TEXT;

-- CreateIndex
CREATE INDEX "CenterInvitation_createdByMembershipId_idx" ON "CenterInvitation"("createdByMembershipId");

-- AddForeignKey
ALTER TABLE "CenterMembership" ADD CONSTRAINT "CenterMembership_joinedViaInvitationId_fkey" FOREIGN KEY ("joinedViaInvitationId") REFERENCES "CenterInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterInvitation" ADD CONSTRAINT "CenterInvitation_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "CenterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
