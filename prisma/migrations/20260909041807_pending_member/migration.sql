-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
