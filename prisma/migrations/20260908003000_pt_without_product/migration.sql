-- PT 계약을 센터 상품에서 떼어낸다.
--
-- PTContract.productId 가 필수이고 PTProduct.centerId 가 필수라, 혼자 하는
-- 트레이너는 센터를 먼저 만들지 않고서는 "김수정 / 20회" 조차 등록할 수 없었다.
-- 계약이 스스로 서게 만든다.
--
-- 결제 금액(priceSnapshot)은 뺀다. FitNote 는 결제를 하지 않는다. 돈은 센터나
-- 트레이너가 이미 따로 받고, 우리가 할 일은 몇 회를 언제까지 쓰는지 관리하는
-- 것이다. 받지 않을 값을 칸으로 두면 화면 어딘가에 결국 입력란이 생긴다.

-- 1. 계약 이름. productNameSnapshot 은 상품이 없어진 지금 거짓말이 된 이름이다.
ALTER TABLE "PTContract" RENAME COLUMN "productNameSnapshot" TO "title";

-- 2. 상품은 선택. 지난 계약이 가리키던 상품은 그대로 둔다.
ALTER TABLE "PTContract" DROP CONSTRAINT "PTContract_productId_fkey";
ALTER TABLE "PTContract" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "PTContract"
  ADD CONSTRAINT "PTContract_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "PTProduct"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. 금액 제거.
ALTER TABLE "PTContract" DROP COLUMN "priceSnapshot";

-- 4. 취소하거나 미룬 쪽.
CREATE TYPE "PTSessionActor" AS ENUM ('MEMBER', 'TRAINER');

-- 5. 차감 여부는 상태에서 파생하지 않고 그때 박아 둔다. 노쇼를 차감할지는
--    트레이너마다 다르고 도중에 바뀌는데, 파생해서 세면 정책을 바꾼 순간
--    지난 계약의 남은 횟수까지 소리 없이 달라진다.
ALTER TABLE "PTSession"
  ADD COLUMN "deducted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancelledBy" "PTSessionActor";

-- 이미 끝난 회차는 횟수를 쓴 것으로 본다. 지금까지 usedSessions 를 그렇게
-- 세어 왔으므로 여기서 말이 달라지면 남은 횟수가 갑자기 늘어난다.
UPDATE "PTSession" SET "deducted" = true WHERE "status" = 'COMPLETED';

-- 6. 미룬 이력. 상태로 만들지 않은 이유는 미룬 수업도 여전히 "앞으로 할 수업"
--    이라 SCHEDULED 로 남아야 하기 때문이다. POSTPONED 같은 상태를 두면 다음
--    수업 목록에서 조용히 빠진다.
CREATE TABLE "PTSessionReschedule" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromScheduledAt" TIMESTAMP(3) NOT NULL,
    "toScheduledAt" TIMESTAMP(3) NOT NULL,
    "movedBy" "PTSessionActor" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PTSessionReschedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PTSessionReschedule_sessionId_idx" ON "PTSessionReschedule"("sessionId");

ALTER TABLE "PTSessionReschedule"
  ADD CONSTRAINT "PTSessionReschedule_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "PTSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
