/**
 * 테스트용으로 만든 계정과 그 데이터를 지운다.
 *
 * 기본은 미리보기다. 무엇을 지울지 세기만 하고 아무것도 바꾸지 않는다.
 * 실제로 지우려면 --apply 를 붙인다. 전부 한 트랜잭션이라 중간에 실패하면
 * 아무것도 지워지지 않는다.
 *
 *   DATABASE_URL=... npx tsx scripts/cleanup-test-users.mts
 *   DATABASE_URL=... npx tsx scripts/cleanup-test-users.mts --apply
 *   --include-demo  demo.*@fitnote.test 계정(데모 데이터)도 함께 지운다.
 *
 * 이메일이 test.local / acttest-…@example.com / demo.…@fitnote.test 인 계정만 대상이다.
 * 실제 사용자는 이 조건에 걸리지 않는다. 올린 사진 파일(Storage)은 지우지 않는다.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const apply = process.argv.includes("--apply");
const includeDemo = process.argv.includes("--include-demo");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: "@test.local" } },
        { email: { startsWith: "acttest-", endsWith: "@example.com" } },
        ...(includeDemo
          ? [{ email: { startsWith: "demo.", endsWith: "@fitnote.test" } }]
          : []),
      ],
    },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`대상 계정 ${users.length}개`);
  for (const u of users) console.log(`  ${u.email}  (${u.name})`);

  if (users.length === 0) return;

  const ids = users.map((u) => u.id);
  const profiles = await prisma.trainerProfile.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  const tp = profiles.map((p) => p.id);

  // 회원 쪽이거나 트레이너 쪽이거나, 대상 계정이 낀 기록 전부.
  const journalWhere = {
    OR: [{ memberUserId: { in: ids } }, { trainerProfileId: { in: tp } }],
  };
  const sessionWhere = {
    OR: [{ memberUserId: { in: ids } }, { trainerProfileId: { in: tp } }],
  };

  const counts = {
    알림장: await prisma.journal.count({ where: journalWhere }),
    "PT 계약": await prisma.pTContract.count({ where: sessionWhere }),
    "PT 수업": await prisma.pTSession.count({ where: sessionWhere }),
    연결: await prisma.trainerMemberConnection.count({
      where: {
        OR: [{ memberUserId: { in: ids } }, { trainerProfileId: { in: tp } }],
      },
    }),
  };
  console.log("딸린 데이터:", counts);

  if (!apply) {
    console.log("\n미리보기입니다. 지우려면 --apply 를 붙이세요.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.dietFeedback.deleteMany({
        where: {
          OR: [
            { dietRecord: { userId: { in: ids } } },
            { trainerProfileId: { in: tp } },
          ],
        },
      });
      await tx.dietRecord.deleteMany({ where: { userId: { in: ids } } });
      await tx.journalComment.deleteMany({
        where: { OR: [{ journal: journalWhere }, { authorUserId: { in: ids } }] },
      });
      await tx.journalPhoto.deleteMany({ where: { journal: journalWhere } });
      await tx.journal.deleteMany({ where: journalWhere });
      await tx.workoutSet.deleteMany({
        where: { record: { userId: { in: ids } } },
      });
      await tx.workoutRecord.deleteMany({ where: { userId: { in: ids } } });
      await tx.workoutSession.deleteMany({
        where: {
          OR: [{ userId: { in: ids } }, { recordedByUserId: { in: ids } }],
        },
      });
      await tx.pTSessionReschedule.deleteMany({
        where: { session: sessionWhere },
      });
      await tx.pTSession.deleteMany({ where: sessionWhere });
      await tx.pTContract.deleteMany({ where: sessionWhere });
      await tx.trainerPTPrice.deleteMany({ where: { trainerProfileId: { in: tp } } });
      await tx.goal.deleteMany({ where: { userId: { in: ids } } });
      await tx.bodyRecord.deleteMany({ where: { userId: { in: ids } } });
      await tx.workoutFavorite.deleteMany({ where: { userId: { in: ids } } });
      await tx.routine.deleteMany({
        where: { createdByTrainerProfileId: { in: tp } },
      });
      await tx.trainerSharingSetting.deleteMany({ where: { userId: { in: ids } } });
      await tx.memberClaimCode.deleteMany({
        where: {
          OR: [{ memberUserId: { in: ids } }, { trainerProfileId: { in: tp } }],
        },
      });
      await tx.trainerMemberConnection.deleteMany({
        where: {
          OR: [{ memberUserId: { in: ids } }, { trainerProfileId: { in: tp } }],
        },
      });
      await tx.trainerInvitation.deleteMany({
        where: { trainerProfileId: { in: tp } },
      });
      await tx.notice.deleteMany({
        where: { authorMembership: { userId: { in: ids } } },
      });
      await tx.trainerProfile.deleteMany({ where: { userId: { in: ids } } });
      // 프로필·센터 소속·알림·기기 토큰·로그인 세션은 계정을 지우면 함께 지워진다.
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    },
    { timeout: 60_000 },
  );

  console.log(`\n지웠습니다: 계정 ${users.length}개`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
