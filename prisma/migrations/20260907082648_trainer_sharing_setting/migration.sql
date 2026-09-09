-- CreateTable
CREATE TABLE "TrainerSharingSetting" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "shareDiet" BOOLEAN NOT NULL DEFAULT true,
    "shareDietPhoto" BOOLEAN NOT NULL DEFAULT true,
    "sharePersonalWorkout" BOOLEAN NOT NULL DEFAULT false,
    "shareBody" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerSharingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainerSharingSetting_membershipId_key" ON "TrainerSharingSetting"("membershipId");

-- AddForeignKey
ALTER TABLE "TrainerSharingSetting" ADD CONSTRAINT "TrainerSharingSetting_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CenterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
