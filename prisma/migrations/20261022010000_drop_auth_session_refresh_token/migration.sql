-- DropIndex
DROP INDEX "AuthSession_refreshTokenHash_key";
-- AlterTable
ALTER TABLE "AuthSession" DROP COLUMN "refreshTokenHash";
