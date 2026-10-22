-- CreateTable
CREATE TABLE "MemberClaimCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "trainerProfileId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberClaimCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberClaimCode_code_key" ON "MemberClaimCode"("code");

-- CreateIndex
CREATE INDEX "MemberClaimCode_memberUserId_idx" ON "MemberClaimCode"("memberUserId");

-- CreateIndex
CREATE INDEX "MemberClaimCode_trainerProfileId_idx" ON "MemberClaimCode"("trainerProfileId");

-- AddForeignKey
ALTER TABLE "MemberClaimCode" ADD CONSTRAINT "MemberClaimCode_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberClaimCode" ADD CONSTRAINT "MemberClaimCode_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
