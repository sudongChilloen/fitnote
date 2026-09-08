-- 트레이너를 센터에서 떼어낸다.
--
-- 예전에는 CenterMembership 하나가 두 가지 일을 했다. "이 사람이 이 센터와 어떤
-- 관계인가" 와 "PT 관계에서 이 사람을 가리키는 신분증" 이다. 뒤엣것 때문에 센터
-- 없는 트레이너가 존재할 수 없었고, 트레이너가 센터를 옮기면 그가 쌓은 회원
-- 관계와 알림장이 통째로 끊겼다.
--
-- 이 마이그레이션은 뒤엣것만 떼어 TrainerProfile 과 User 로 옮긴다. 지우고 다시
-- 만들지 않고 한 줄씩 옮기는 이유는, 이 파일이 언젠가 데이터가 든 데이터베이스
-- 에서도 돌아야 하기 때문이다. 개발용이라고 지워 버리면 그때 쓸 절차가 없다.

CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'ENDED');

-- ============================================================
-- 1. TrainerProfile 을 User 에 건다
-- ============================================================

ALTER TABLE "TrainerProfile"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "displayName" TEXT;

UPDATE "TrainerProfile" tp
   SET "userId" = cm."userId"
  FROM "CenterMembership" cm
 WHERE cm."id" = tp."membershipId";

-- 한 사람이 두 센터에 트레이너로 있었다면 프로필이 둘이 된다. 먼저 만든 것만 남긴다.
DELETE FROM "TrainerProfile" a
 USING "TrainerProfile" b
 WHERE a."userId" = b."userId"
   AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

DELETE FROM "TrainerProfile" WHERE "userId" IS NULL;

-- 옛 칸을 먼저 뗀다. membershipId 가 NOT NULL 인 채로 새 프로필을 넣을 수 없다.
ALTER TABLE "TrainerProfile" DROP CONSTRAINT "TrainerProfile_membershipId_fkey";
DROP INDEX "TrainerProfile_membershipId_key";
ALTER TABLE "TrainerProfile" DROP COLUMN "membershipId";

-- 프로필을 만든 적 없는 트레이너에게도 만들어 준다. 아래에서 알림장과 PT 가
-- 이 프로필을 가리키게 되므로, 없으면 그 기록들이 갈 곳을 잃는다.
INSERT INTO "TrainerProfile" ("id", "userId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."userId", NOW(), NOW()
  FROM (
       SELECT DISTINCT cm."userId"
         FROM "CenterMembership" cm
        WHERE cm."role" IN ('TRAINER', 'CENTER_ADMIN')
          AND NOT EXISTS (
              SELECT 1 FROM "TrainerProfile" p WHERE p."userId" = cm."userId"
          )
       ) u;

ALTER TABLE "TrainerProfile" ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "TrainerProfile_userId_key" ON "TrainerProfile"("userId");

ALTER TABLE "TrainerProfile"
  ADD CONSTRAINT "TrainerProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 2. 코칭 관계를 별도 표로 옮긴다
-- ============================================================

CREATE TABLE "TrainerMemberConnection" (
    "id" TEXT NOT NULL,
    "trainerProfileId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "originCenterId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerMemberConnection_pkey" PRIMARY KEY ("id")
);

-- 담당 배정을 관계로 옮긴다. 관계가 시작된 센터를 originCenterId 에 적어 둔다.
INSERT INTO "TrainerMemberConnection"
  ("id", "trainerProfileId", "memberUserId", "status", "originCenterId",
   "startedAt", "endedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       tp."id",
       m."userId",
       CASE WHEN m."status" = 'ACTIVE' THEN 'ACTIVE'::"ConnectionStatus"
            ELSE 'ENDED'::"ConnectionStatus" END,
       m."centerId",
       m."joinedAt",
       CASE WHEN m."status" = 'ACTIVE' THEN NULL ELSE COALESCE(m."leftAt", NOW()) END,
       NOW(),
       NOW()
  FROM "CenterMembership" m
  JOIN "CenterMembership" t ON t."id" = m."assignedTrainerMembershipId"
  JOIN "TrainerProfile" tp ON tp."userId" = t."userId"
 WHERE m."assignedTrainerMembershipId" IS NOT NULL;

CREATE INDEX "TrainerMemberConnection_memberUserId_status_idx" ON "TrainerMemberConnection"("memberUserId", "status");
CREATE INDEX "TrainerMemberConnection_trainerProfileId_status_idx" ON "TrainerMemberConnection"("trainerProfileId", "status");
CREATE UNIQUE INDEX "TrainerMemberConnection_trainerProfileId_memberUserId_key" ON "TrainerMemberConnection"("trainerProfileId", "memberUserId");

ALTER TABLE "TrainerMemberConnection" ADD CONSTRAINT "TrainerMemberConnection_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerMemberConnection" ADD CONSTRAINT "TrainerMemberConnection_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerMemberConnection" ADD CONSTRAINT "TrainerMemberConnection_originCenterId_fkey" FOREIGN KEY ("originCenterId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CenterMembership" DROP CONSTRAINT "CenterMembership_assignedTrainerMembershipId_fkey";
DROP INDEX "CenterMembership_assignedTrainerMembershipId_idx";
ALTER TABLE "CenterMembership" DROP COLUMN "assignedTrainerMembershipId";

-- ============================================================
-- 3. 트레이너 초대 코드
-- ============================================================

CREATE TABLE "TrainerInvitation" (
    "id" TEXT NOT NULL,
    "trainerProfileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 50,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerInvitation_code_key" ON "TrainerInvitation"("code");
CREATE INDEX "TrainerInvitation_trainerProfileId_idx" ON "TrainerInvitation"("trainerProfileId");
CREATE INDEX "TrainerInvitation_expiresAt_idx" ON "TrainerInvitation"("expiresAt");

ALTER TABLE "TrainerInvitation" ADD CONSTRAINT "TrainerInvitation_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4. 공유 설정을 회원 계정으로
-- ============================================================

ALTER TABLE "TrainerSharingSetting" ADD COLUMN "userId" TEXT;

UPDATE "TrainerSharingSetting" s
   SET "userId" = cm."userId"
  FROM "CenterMembership" cm
 WHERE cm."id" = s."membershipId";

-- 두 센터에 설정이 따로 있었다면 최근 것을 남긴다. 회원이 마지막으로 정한 뜻이다.
DELETE FROM "TrainerSharingSetting" a
 USING "TrainerSharingSetting" b
 WHERE a."userId" = b."userId"
   AND (a."updatedAt" < b."updatedAt" OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id"));

DELETE FROM "TrainerSharingSetting" WHERE "userId" IS NULL;

ALTER TABLE "TrainerSharingSetting" DROP CONSTRAINT "TrainerSharingSetting_membershipId_fkey";
DROP INDEX "TrainerSharingSetting_membershipId_key";
ALTER TABLE "TrainerSharingSetting"
  DROP COLUMN "membershipId",
  ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "TrainerSharingSetting_userId_key" ON "TrainerSharingSetting"("userId");
ALTER TABLE "TrainerSharingSetting" ADD CONSTRAINT "TrainerSharingSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 5. PT 계약 · 수업
-- ============================================================

ALTER TABLE "PTContract"
  ADD COLUMN "memberUserId" TEXT,
  ADD COLUMN "trainerProfileId" TEXT,
  ADD COLUMN "centerId" TEXT;

-- 지난 계약은 회원이 그때 소속돼 있던 센터에서 맺어진 것이다.
UPDATE "PTContract" c
   SET "centerId" = m."centerId"
  FROM "CenterMembership" m
 WHERE m."id" = c."memberMembershipId";

UPDATE "PTContract" c
   SET "memberUserId" = m."userId"
  FROM "CenterMembership" m
 WHERE m."id" = c."memberMembershipId";

UPDATE "PTContract" c
   SET "trainerProfileId" = tp."id"
  FROM "CenterMembership" t
  JOIN "TrainerProfile" tp ON tp."userId" = t."userId"
 WHERE t."id" = c."trainerMembershipId";

DELETE FROM "PTContract" WHERE "memberUserId" IS NULL OR "trainerProfileId" IS NULL;

ALTER TABLE "PTSession" ADD COLUMN "memberUserId" TEXT, ADD COLUMN "trainerProfileId" TEXT;

UPDATE "PTSession" s
   SET "memberUserId" = m."userId"
  FROM "CenterMembership" m
 WHERE m."id" = s."memberMembershipId";

UPDATE "PTSession" s
   SET "trainerProfileId" = tp."id"
  FROM "CenterMembership" t
  JOIN "TrainerProfile" tp ON tp."userId" = t."userId"
 WHERE t."id" = s."trainerMembershipId";

DELETE FROM "PTSession" WHERE "memberUserId" IS NULL OR "trainerProfileId" IS NULL;

ALTER TABLE "PTContract" DROP CONSTRAINT "PTContract_memberMembershipId_fkey";
ALTER TABLE "PTContract" DROP CONSTRAINT "PTContract_trainerMembershipId_fkey";
DROP INDEX "PTContract_memberMembershipId_status_idx";
DROP INDEX "PTContract_trainerMembershipId_status_idx";
ALTER TABLE "PTContract"
  DROP COLUMN "memberMembershipId",
  DROP COLUMN "trainerMembershipId",
  ALTER COLUMN "memberUserId" SET NOT NULL,
  ALTER COLUMN "trainerProfileId" SET NOT NULL;

CREATE INDEX "PTContract_memberUserId_status_idx" ON "PTContract"("memberUserId", "status");
CREATE INDEX "PTContract_trainerProfileId_status_idx" ON "PTContract"("trainerProfileId", "status");
CREATE INDEX "PTContract_centerId_status_idx" ON "PTContract"("centerId", "status");
ALTER TABLE "PTContract" ADD CONSTRAINT "PTContract_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PTContract" ADD CONSTRAINT "PTContract_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PTContract" ADD CONSTRAINT "PTContract_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PTSession" DROP CONSTRAINT "PTSession_memberMembershipId_fkey";
ALTER TABLE "PTSession" DROP CONSTRAINT "PTSession_trainerMembershipId_fkey";
DROP INDEX "PTSession_memberMembershipId_scheduledAt_idx";
DROP INDEX "PTSession_trainerMembershipId_scheduledAt_idx";
ALTER TABLE "PTSession"
  DROP COLUMN "memberMembershipId",
  DROP COLUMN "trainerMembershipId",
  ALTER COLUMN "memberUserId" SET NOT NULL,
  ALTER COLUMN "trainerProfileId" SET NOT NULL;

CREATE INDEX "PTSession_trainerProfileId_scheduledAt_idx" ON "PTSession"("trainerProfileId", "scheduledAt");
CREATE INDEX "PTSession_memberUserId_scheduledAt_idx" ON "PTSession"("memberUserId", "scheduledAt");
ALTER TABLE "PTSession" ADD CONSTRAINT "PTSession_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PTSession" ADD CONSTRAINT "PTSession_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 6. 알림장 · 댓글
-- ============================================================

ALTER TABLE "Journal" ADD COLUMN "memberUserId" TEXT, ADD COLUMN "trainerProfileId" TEXT;

UPDATE "Journal" j
   SET "memberUserId" = m."userId"
  FROM "CenterMembership" m
 WHERE m."id" = j."memberMembershipId";

UPDATE "Journal" j
   SET "trainerProfileId" = tp."id"
  FROM "CenterMembership" t
  JOIN "TrainerProfile" tp ON tp."userId" = t."userId"
 WHERE t."id" = j."trainerMembershipId";

DELETE FROM "Journal" WHERE "memberUserId" IS NULL OR "trainerProfileId" IS NULL;

-- 댓글은 트레이너와 회원이 같이 쓴다. 둘의 공통 신분은 User 뿐이다.
ALTER TABLE "JournalComment" ADD COLUMN "authorUserId" TEXT;

UPDATE "JournalComment" c
   SET "authorUserId" = m."userId"
  FROM "CenterMembership" m
 WHERE m."id" = c."authorMembershipId";

DELETE FROM "JournalComment" WHERE "authorUserId" IS NULL;

ALTER TABLE "Journal" DROP CONSTRAINT "Journal_memberMembershipId_fkey";
ALTER TABLE "Journal" DROP CONSTRAINT "Journal_trainerMembershipId_fkey";
DROP INDEX "Journal_memberMembershipId_date_idx";
DROP INDEX "Journal_memberMembershipId_memberReadAt_idx";
DROP INDEX "Journal_trainerMembershipId_date_idx";
ALTER TABLE "Journal"
  DROP COLUMN "memberMembershipId",
  DROP COLUMN "trainerMembershipId",
  ALTER COLUMN "memberUserId" SET NOT NULL,
  ALTER COLUMN "trainerProfileId" SET NOT NULL;

CREATE INDEX "Journal_memberUserId_date_idx" ON "Journal"("memberUserId", "date");
CREATE INDEX "Journal_trainerProfileId_date_idx" ON "Journal"("trainerProfileId", "date");
CREATE INDEX "Journal_memberUserId_memberReadAt_idx" ON "Journal"("memberUserId", "memberReadAt");
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalComment" DROP CONSTRAINT "JournalComment_authorMembershipId_fkey";
DROP INDEX "JournalComment_authorMembershipId_idx";
ALTER TABLE "JournalComment"
  DROP COLUMN "authorMembershipId",
  ALTER COLUMN "authorUserId" SET NOT NULL;

CREATE INDEX "JournalComment_authorUserId_idx" ON "JournalComment"("authorUserId");
ALTER TABLE "JournalComment" ADD CONSTRAINT "JournalComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 7. 식단 피드백 · PT 가격 · 루틴
-- ============================================================

ALTER TABLE "DietFeedback" ADD COLUMN "trainerProfileId" TEXT;

UPDATE "DietFeedback" f
   SET "trainerProfileId" = tp."id"
  FROM "CenterMembership" t
  JOIN "TrainerProfile" tp ON tp."userId" = t."userId"
 WHERE t."id" = f."trainerMembershipId";

DELETE FROM "DietFeedback" WHERE "trainerProfileId" IS NULL;

ALTER TABLE "DietFeedback" DROP CONSTRAINT "DietFeedback_trainerMembershipId_fkey";
DROP INDEX "DietFeedback_trainerMembershipId_createdAt_idx";
ALTER TABLE "DietFeedback"
  DROP COLUMN "trainerMembershipId",
  ALTER COLUMN "trainerProfileId" SET NOT NULL;

CREATE INDEX "DietFeedback_trainerProfileId_createdAt_idx" ON "DietFeedback"("trainerProfileId", "createdAt");
ALTER TABLE "DietFeedback" ADD CONSTRAINT "DietFeedback_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrainerPTPrice" ADD COLUMN "trainerProfileId" TEXT;

UPDATE "TrainerPTPrice" p
   SET "trainerProfileId" = tp."id"
  FROM "CenterMembership" t
  JOIN "TrainerProfile" tp ON tp."userId" = t."userId"
 WHERE t."id" = p."trainerMembershipId";

DELETE FROM "TrainerPTPrice" WHERE "trainerProfileId" IS NULL;

-- 두 센터에서 같은 상품에 값을 매겼다면 한 줄만 남는다.
DELETE FROM "TrainerPTPrice" a
 USING "TrainerPTPrice" b
 WHERE a."trainerProfileId" = b."trainerProfileId"
   AND a."productId" = b."productId"
   AND a."id" > b."id";

ALTER TABLE "TrainerPTPrice" DROP CONSTRAINT "TrainerPTPrice_trainerMembershipId_fkey";
DROP INDEX "TrainerPTPrice_trainerMembershipId_productId_key";
ALTER TABLE "TrainerPTPrice"
  DROP COLUMN "trainerMembershipId",
  ALTER COLUMN "trainerProfileId" SET NOT NULL;

CREATE UNIQUE INDEX "TrainerPTPrice_trainerProfileId_productId_key" ON "TrainerPTPrice"("trainerProfileId", "productId");
ALTER TABLE "TrainerPTPrice" ADD CONSTRAINT "TrainerPTPrice_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Routine" ADD COLUMN "createdByTrainerProfileId" TEXT;

UPDATE "Routine" r
   SET "createdByTrainerProfileId" = tp."id"
  FROM "CenterMembership" t
  JOIN "TrainerProfile" tp ON tp."userId" = t."userId"
 WHERE t."id" = r."createdByTrainerMembershipId";

ALTER TABLE "Routine" DROP CONSTRAINT "Routine_createdByTrainerMembershipId_fkey";
DROP INDEX "Routine_createdByTrainerMembershipId_idx";
ALTER TABLE "Routine" DROP COLUMN "createdByTrainerMembershipId";

CREATE INDEX "Routine_createdByTrainerProfileId_idx" ON "Routine"("createdByTrainerProfileId");
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_createdByTrainerProfileId_fkey" FOREIGN KEY ("createdByTrainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
