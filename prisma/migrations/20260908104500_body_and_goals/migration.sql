-- 체성분은 하루 한 줄로 둔다.
-- 이미 같은 날 여러 줄이 있으면 가장 나중에 만든 것만 남긴다.
DELETE FROM "BodyRecord" a
USING "BodyRecord" b
WHERE a."userId" = b."userId"
  AND date_trunc('day', a."recordedAt" AT TIME ZONE 'Asia/Seoul')
    = date_trunc('day', b."recordedAt" AT TIME ZONE 'Asia/Seoul')
  AND a."createdAt" < b."createdAt";

-- 남은 줄의 시각을 KST 그 날 0시로 맞춘다.
UPDATE "BodyRecord"
SET "recordedAt" = date_trunc('day', "recordedAt" AT TIME ZONE 'Asia/Seoul')
  AT TIME ZONE 'Asia/Seoul';

CREATE UNIQUE INDEX "BodyRecord_userId_recordedAt_key"
  ON "BodyRecord"("userId", "recordedAt");

-- 목표의 지금 값은 저장하지 않고 최신 기록에서 읽는다.
-- 대신 목표를 세울 때의 값을 남긴다.
ALTER TABLE "Goal" ADD COLUMN "startValue" DECIMAL(65,30);

UPDATE "Goal" SET "startValue" = "currentValue" WHERE "currentValue" IS NOT NULL;

ALTER TABLE "Goal" DROP COLUMN "currentValue";
