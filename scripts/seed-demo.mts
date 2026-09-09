/**
 * 트레이너 화면을 손으로 둘러보기 위한 데모 데이터.
 *
 * 여러 번 돌려도 되도록 demo- 로 시작하는 계정을 먼저 지우고 다시 만든다.
 * 실제 사용자 데이터는 건드리지 않는다.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });
config({ path: ".env" });

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DAY = 86_400_000;
const now = Date.now();
const ago = (n: number) => new Date(now - n * DAY);
const ahead = (n: number) => new Date(now + n * DAY);

/** KST 기준 그 날 특정 시각. */
function at(daysAgo: number, hour: number, minute = 0) {
  const d = new Date(now - daysAgo * DAY);
  const kst = new Date(d.getTime() + 9 * 3600_000);
  kst.setUTCHours(hour, minute, 0, 0);
  return new Date(kst.getTime() - 9 * 3600_000);
}

function kstMidnight(daysAgo: number) {
  return at(daysAgo, 0, 0);
}

const PASSWORD = "test1234";
const EMAILS = {
  trainer: "demo.trainer@fitnote.test",
  m1: "demo.member1@fitnote.test",
  m2: "demo.member2@fitnote.test",
  m3: "demo.member3@fitnote.test",
};

async function wipe() {
  const users = await prisma.user.findMany({
    where: { email: { in: Object.values(EMAILS) } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;

  await prisma.dietFeedback.deleteMany({
    where: { dietRecord: { userId: { in: ids } } },
  });
  await prisma.dietRecord.deleteMany({ where: { userId: { in: ids } } });
  await prisma.journalComment.deleteMany({
    where: { journal: { memberUserId: { in: ids } } },
  });
  await prisma.journalPhoto.deleteMany({
    where: { journal: { memberUserId: { in: ids } } },
  });
  await prisma.journal.deleteMany({ where: { memberUserId: { in: ids } } });
  await prisma.workoutSet.deleteMany({
    where: { record: { userId: { in: ids } } },
  });
  await prisma.workoutRecord.deleteMany({ where: { userId: { in: ids } } });
  await prisma.workoutSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.pTSessionReschedule.deleteMany({
    where: { session: { memberUserId: { in: ids } } },
  });
  await prisma.pTSession.deleteMany({ where: { memberUserId: { in: ids } } });
  await prisma.pTContract.deleteMany({ where: { memberUserId: { in: ids } } });
  await prisma.goal.deleteMany({ where: { userId: { in: ids } } });
  await prisma.bodyRecord.deleteMany({ where: { userId: { in: ids } } });
  await prisma.workoutFavorite.deleteMany({ where: { userId: { in: ids } } });
  await prisma.trainerSharingSetting.deleteMany({
    where: { userId: { in: ids } },
  });
  await prisma.trainerMemberConnection.deleteMany({
    where: { memberUserId: { in: ids } },
  });
  await prisma.trainerInvitation.deleteMany({
    where: { trainerProfile: { userId: { in: ids } } },
  });
  await prisma.trainerProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  await wipe();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const exercises = await prisma.exercise.findMany({
    take: 12,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (exercises.length === 0) {
    throw new Error("운동 시드가 없다. prisma seed 를 먼저 돌려야 한다.");
  }

  const trainerUser = await prisma.user.create({
    data: { email: EMAILS.trainer, name: "박준호", passwordHash },
  });
  const trainer = await prisma.trainerProfile.create({
    data: {
      userId: trainerUser.id,
      displayName: "준호 트레이너",
      bio: "체형 교정과 근력 향상을 함께 봅니다.",
      specialty: "재활 · 근력",
      careerYears: 6,
    },
  });

  // ── 회원 1: 오래 다닌 사람. 재등록했고 체중이 많이 빠졌다. ──────
  const m1 = await prisma.user.create({
    data: { email: EMAILS.m1, name: "김수정", passwordHash },
  });
  const c1 = await prisma.trainerMemberConnection.create({
    data: {
      trainerProfileId: trainer.id,
      memberUserId: m1.id,
      startedAt: ago(210),
    },
  });
  await prisma.trainerSharingSetting.create({
    data: {
      userId: m1.id,
      shareBody: true,
      sharePersonalWorkout: true,
      shareDiet: true,
      shareDietPhoto: true,
    },
  });

  const old1 = await prisma.pTContract.create({
    data: {
      memberUserId: m1.id,
      trainerProfileId: trainer.id,
      title: "PT 20회",
      totalSessions: 20,
      usedSessions: 20,
      startedAt: ago(200),
      expiresAt: ago(80),
      status: "COMPLETED",
    },
  });
  const cur1 = await prisma.pTContract.create({
    data: {
      memberUserId: m1.id,
      trainerProfileId: trainer.id,
      title: "PT 30회",
      totalSessions: 30,
      usedSessions: 8,
      startedAt: ago(70),
      expiresAt: ahead(110),
      status: "ACTIVE",
    },
  });

  for (let i = 0; i < 20; i++) {
    await prisma.pTSession.create({
      data: {
        contractId: old1.id,
        memberUserId: m1.id,
        trainerProfileId: trainer.id,
        sessionNumber: i + 1,
        scheduledAt: at(198 - i * 6, 19),
        completedAt: at(198 - i * 6, 20),
        status: "COMPLETED",
        deducted: true,
      },
    });
  }

  const done1: string[] = [];
  for (let i = 0; i < 7; i++) {
    const s = await prisma.pTSession.create({
      data: {
        contractId: cur1.id,
        memberUserId: m1.id,
        trainerProfileId: trainer.id,
        sessionNumber: i + 1,
        scheduledAt: at(66 - i * 8, 19),
        completedAt: at(66 - i * 8, 20),
        status: "COMPLETED",
        deducted: true,
      },
    });
    done1.push(s.id);
  }
  // 노쇼 한 번, 미룬 회차 한 번 — 계약 화면에서 이력이 보인다.
  await prisma.pTSession.create({
    data: {
      contractId: cur1.id,
      memberUserId: m1.id,
      trainerProfileId: trainer.id,
      sessionNumber: 8,
      scheduledAt: at(9, 19),
      status: "NO_SHOW",
      deducted: true,
    },
  });
  const moved = await prisma.pTSession.create({
    data: {
      contractId: cur1.id,
      memberUserId: m1.id,
      trainerProfileId: trainer.id,
      sessionNumber: 9,
      scheduledAt: at(-1, 19),
      status: "SCHEDULED",
    },
  });
  await prisma.pTSessionReschedule.create({
    data: {
      sessionId: moved.id,
      fromScheduledAt: at(2, 19),
      toScheduledAt: at(-1, 19),
      movedBy: "MEMBER",
      reason: "출장 일정이 겹쳤어요",
    },
  });
  // 오늘 수업 — 트레이너 홈의 "오늘 일정" 에 뜬다.
  await prisma.pTSession.create({
    data: {
      contractId: cur1.id,
      memberUserId: m1.id,
      trainerProfileId: trainer.id,
      sessionNumber: 10,
      scheduledAt: at(0, 19),
      status: "SCHEDULED",
    },
  });

  // 알림장 — 하나는 회원이 답글을 달아 두고, 하나는 초안으로 남긴다.
  const j1 = await prisma.journal.create({
    data: {
      memberUserId: m1.id,
      trainerProfileId: trainer.id,
      ptSessionId: done1[6],
      date: ago(18),
      title: "하체 · 스쿼트 자세 교정",
      content:
        "스쿼트 하단에서 무릎이 안쪽으로 모이는 게 많이 줄었어요. 오늘은 60kg 5회 3세트까지 했습니다.",
      workoutSummary: "스쿼트 60kg 5x3 / 레그프레스 120kg 10x3 / 힙쓰러스트",
      dietGuidance: "저녁 단백질이 조금 부족해요. 닭가슴살 한 조각 더.",
      caution: "무릎 통증 있으면 바로 말씀 주세요.",
      nextGoal: "다음 시간엔 65kg 시도",
      status: "PUBLISHED",
      publishedAt: ago(18),
      memberReadAt: ago(17),
    },
  });
  await prisma.journalComment.create({
    data: {
      journalId: j1.id,
      authorUserId: m1.id,
      content: "감사합니다! 다음주에 65kg 해볼게요",
      createdAt: ago(17),
    },
  });
  await prisma.journal.create({
    data: {
      memberUserId: m1.id,
      trainerProfileId: trainer.id,
      ptSessionId: done1[5],
      date: ago(26),
      title: "등 · 랫풀다운",
      content: "광배 자극이 좋아졌습니다.",
      status: "PUBLISHED",
      publishedAt: ago(26),
    },
  });

  // 체성분 — 82 에서 71 까지. 여정에 -3 / -6 / -9 마디가 생긴다.
  const w1: [number, number, number][] = [
    [205, 82, 31],
    [180, 80.4, 30],
    [150, 78.2, 28.5],
    [120, 76, 27],
    [90, 74.5, 26],
    [60, 73.1, 25],
    [30, 72, 24.2],
    [7, 71.2, 23.5],
    [1, 71, 23.4],
  ];
  for (const [d, kg, fat] of w1) {
    await prisma.bodyRecord.create({
      data: {
        userId: m1.id,
        recordedAt: kstMidnight(d),
        weightKg: kg,
        bodyFatPercent: fat,
        skeletalMuscleKg: 28 + (205 - d) / 120,
        waistCm: 92 - (205 - d) / 20,
      },
    });
  }
  await prisma.goal.create({
    data: {
      userId: m1.id,
      type: "WEIGHT",
      title: "70kg 만들기",
      startValue: 82,
      targetValue: 70,
      startDate: ago(205),
      targetDate: ahead(60),
      unit: "kg",
    },
  });

  // 개인 운동 (공유 켜져 있어서 트레이너에게 보인다)
  for (let i = 0; i < 5; i++) {
    const session = await prisma.workoutSession.create({
      data: {
        userId: m1.id,
        startedAt: at(3 + i * 4, 7),
        endedAt: at(3 + i * 4, 8),
        durationSec: 3600,
        status: "COMPLETED",
        memo: i % 2 === 0 ? "아침 운동" : null,
      },
    });
    for (let k = 0; k < 3; k++) {
      const ex = exercises[(i + k) % exercises.length];
      const record = await prisma.workoutRecord.create({
        data: {
          sessionId: session.id,
          exerciseId: ex.id,
          userId: m1.id,
          orderIndex: k,
        },
      });
      for (let sn = 1; sn <= 3; sn++) {
        await prisma.workoutSet.create({
          data: {
            recordId: record.id,
            setNumber: sn,
            weight: 40 + k * 10,
            reps: 10,
          },
        });
      }
    }
  }

  // 식단
  const meals: [number, "BREAKFAST" | "LUNCH" | "DINNER", string][] = [
    [0, "BREAKFAST", "그릭요거트와 블루베리"],
    [0, "LUNCH", "닭가슴살 샐러드"],
    [1, "DINNER", "연어구이와 현미밥"],
    [2, "LUNCH", "제육볶음 백반"],
    [3, "BREAKFAST", "삶은 계란 2개, 바나나"],
  ];
  for (const [d, mealType, foodName] of meals) {
    await prisma.dietRecord.create({
      data: {
        userId: m1.id,
        date: kstMidnight(d),
        mealType,
        foodName,
        calories: 320 + d * 40,
        protein: 30,
        carbohydrate: 25,
        fat: 12,
      },
    });
  }

  // ── 회원 2: 이제 막 시작. 공유를 꺼 둬서 게이트가 보인다. ──────
  const m2 = await prisma.user.create({
    data: { email: EMAILS.m2, name: "이도현", passwordHash },
  });
  const c2 = await prisma.trainerMemberConnection.create({
    data: {
      trainerProfileId: trainer.id,
      memberUserId: m2.id,
      startedAt: ago(21),
    },
  });
  const cur2 = await prisma.pTContract.create({
    data: {
      memberUserId: m2.id,
      trainerProfileId: trainer.id,
      title: "PT 10회",
      totalSessions: 10,
      usedSessions: 3,
      startedAt: ago(20),
      expiresAt: ahead(70),
      status: "ACTIVE",
    },
  });
  for (let i = 0; i < 3; i++) {
    await prisma.pTSession.create({
      data: {
        contractId: cur2.id,
        memberUserId: m2.id,
        trainerProfileId: trainer.id,
        sessionNumber: i + 1,
        scheduledAt: at(18 - i * 6, 20),
        completedAt: at(18 - i * 6, 21),
        status: "COMPLETED",
        deducted: true,
      },
    });
  }
  await prisma.pTSession.create({
    data: {
      contractId: cur2.id,
      memberUserId: m2.id,
      trainerProfileId: trainer.id,
      sessionNumber: 4,
      scheduledAt: at(0, 20, 30),
      status: "SCHEDULED",
    },
  });
  await prisma.pTSession.create({
    data: {
      contractId: cur2.id,
      memberUserId: m2.id,
      trainerProfileId: trainer.id,
      sessionNumber: 5,
      scheduledAt: at(-3, 20, 30),
      status: "SCHEDULED",
    },
  });

  // ── 회원 3: 계약이 없는 사람. 빈 상태를 보려고 둔다. ──────────
  const m3 = await prisma.user.create({
    data: { email: EMAILS.m3, name: "최민서", passwordHash },
  });
  const c3 = await prisma.trainerMemberConnection.create({
    data: {
      trainerProfileId: trainer.id,
      memberUserId: m3.id,
      startedAt: ago(2),
    },
  });

  console.log("\n=== 데모 계정 ===");
  console.log(`트레이너  ${EMAILS.trainer} / ${PASSWORD}`);
  console.log(`회원(김수정) ${EMAILS.m1} / ${PASSWORD}`);
  console.log("\n=== 바로 가 볼 곳 ===");
  console.log("트레이너 홈       /trainer");
  console.log(`회원 상세(김수정)  /trainer/members/${c1.id}`);
  console.log(`  계약 회차        /trainer/members/${c1.id}/contracts/${cur1.id}`);
  console.log(`  여정             /trainer/members/${c1.id}/journey`);
  console.log(`  식단             /trainer/members/${c1.id}/diet`);
  console.log(`  알림장           /trainer/journals/${j1.id}`);
  console.log(`회원 상세(이도현)  /trainer/members/${c2.id}   (공유 꺼짐)`);
  console.log(`회원 상세(최민서)  /trainer/members/${c3.id}   (계약 없음)`);
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
