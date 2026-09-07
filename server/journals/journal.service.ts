import "server-only";

import { prisma } from "@/lib/prisma";
import { createSignedReadUrls } from "@/lib/storage";
import { JournalStatus, NoticeScope } from "@/generated/prisma/enums";
import { getCurrentMembership } from "@/server/centers/center.service";

export class JournalError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "JournalError";
  }
}

export type TimelineEntry =
  | {
      kind: "JOURNAL";
      id: string;
      date: Date;
      title: string;
      preview: string;
      authorName: string;
      photoCount: number;
      commentCount: number;
      unread: boolean;
    }
  | {
      kind: "NOTICE";
      id: string;
      date: Date;
      title: string;
      preview: string;
      authorName: string;
      pinned: boolean;
      unread: boolean;
    }
  | {
      kind: "WORKOUT";
      id: string;
      date: Date;
      title: string;
      preview: string;
      authorName: string | null;
      isPt: boolean;
    };

function preview(text: string, length = 60) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}...` : flat;
}

/**
 * 회원이 볼 수 있는 공지의 조건.
 *
 * 대상을 회원 목록으로 펼쳐 저장하지 않고 여기서 계산한다. 미리 펼치면 회원이
 * 들어오고 나갈 때마다 지난 공지의 대상까지 손봐야 한다.
 */
function noticeVisibility(membership: {
  centerId: string;
  assignedTrainerMembershipId: string | null;
}) {
  const scopes: object[] = [{ scope: NoticeScope.CENTER }];

  if (membership.assignedTrainerMembershipId) {
    scopes.push({
      scope: NoticeScope.TRAINER_MEMBERS,
      authorMembershipId: membership.assignedTrainerMembershipId,
    });
  }

  return {
    centerId: membership.centerId,
    publishedAt: { not: null },
    OR: scopes,
  };
}

/**
 * 알림장 · 공지 · 내 운동을 한 줄로 섞은 목록.
 *
 * 알림장만 모아 두면 화면이 자주 빈다. PT 는 주 두어 번인데 앱은 매일 열기
 * 때문이다. 개인 운동까지 함께 흐르면 그 사이가 메워진다.
 */
export async function getTimeline(userId: string, limit = 30) {
  const membership = await getCurrentMembership(userId);

  const [journals, notices, sessions] = await Promise.all([
    membership
      ? prisma.journal.findMany({
          where: {
            memberMembershipId: membership.id,
            status: JournalStatus.PUBLISHED,
          },
          orderBy: { date: "desc" },
          take: limit,
          select: {
            id: true,
            date: true,
            title: true,
            content: true,
            memberReadAt: true,
            trainerMembership: { select: { user: { select: { name: true } } } },
            _count: { select: { photos: true, comments: true } },
          },
        })
      : [],
    membership
      ? prisma.notice.findMany({
          where: noticeVisibility(membership),
          orderBy: { publishedAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            content: true,
            pinnedAt: true,
            publishedAt: true,
            authorMembership: { select: { user: { select: { name: true } } } },
            reads: {
              where: { membershipId: membership.id },
              select: { id: true },
            },
          },
        })
      : [],
    prisma.workoutSession.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      orderBy: { startedAt: "desc" },
      take: limit,
      select: {
        id: true,
        startedAt: true,
        ptSessionId: true,
        recordedBy: { select: { name: true } },
        records: {
          orderBy: { orderIndex: "asc" },
          select: { exercise: { select: { name: true } } },
        },
      },
    }),
  ]);

  const entries: TimelineEntry[] = [
    ...journals.map((journal): TimelineEntry => ({
      kind: "JOURNAL",
      id: journal.id,
      date: journal.date,
      title: journal.title ?? "PT 알림장",
      preview: preview(journal.content),
      authorName: journal.trainerMembership.user.name,
      photoCount: journal._count.photos,
      commentCount: journal._count.comments,
      unread: journal.memberReadAt === null,
    })),
    ...notices.map((notice): TimelineEntry => ({
      kind: "NOTICE",
      id: notice.id,
      // publishedAt 이 없는 공지는 위 조건에서 걸러진다.
      date: notice.publishedAt!,
      title: notice.title,
      preview: preview(notice.content),
      authorName: notice.authorMembership.user.name,
      pinned: notice.pinnedAt !== null,
      unread: notice.reads.length === 0,
    })),
    ...sessions.map((session): TimelineEntry => {
      const names = session.records.map((record) => record.exercise.name);
      const isPt = session.ptSessionId !== null;

      return {
        kind: "WORKOUT",
        id: session.id,
        date: session.startedAt,
        title: isPt ? "PT 수업" : "개인 운동",
        preview:
          names.length === 0
            ? "기록한 운동 없음"
            : names.length <= 3
              ? names.join(", ")
              : `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}개`,
        authorName: isPt ? (session.recordedBy?.name ?? null) : null,
        isPt,
      };
    }),
  ];

  // 고정 공지는 날짜와 무관하게 맨 위. 나머지는 최신순.
  entries.sort((a, b) => {
    const aPinned = a.kind === "NOTICE" && a.pinned;
    const bPinned = b.kind === "NOTICE" && b.pinned;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return b.date.getTime() - a.date.getTime();
  });

  return {
    hasCenter: membership !== null,
    unreadCount: entries.filter(
      (entry) => entry.kind !== "WORKOUT" && entry.unread,
    ).length,
    entries: entries.slice(0, limit),
  };
}

/**
 * 알림장 상세.
 *
 * 여는 순간 읽음으로 표시한다. 목록에서 배지를 지우려면 여기 말고는 걸 곳이 없다.
 */
/**
 * 저장소 경로에 서명 주소를 붙인다.
 *
 * 서명에 실패한 사진은 빼지 않고 주소를 null 로 둔다. 사진 한 장 때문에 알림장
 * 전체가 안 열리면 안 되고, 없는 척하면 트레이너는 올렸는데 회원은 못 보는 상태가
 * 왜 생겼는지 알 수 없다.
 */
async function withSignedUrls(
  photos: { id: string; storagePath: string; thumbnailPath: string | null }[],
) {
  if (photos.length === 0) return [];

  const paths = photos.flatMap((photo) =>
    photo.thumbnailPath
      ? [photo.storagePath, photo.thumbnailPath]
      : [photo.storagePath],
  );

  let signed = new Map<string, string>();
  try {
    signed = await createSignedReadUrls(paths);
  } catch (error) {
    console.error("photo sign error:", error);
  }

  return photos.map((photo) => ({
    id: photo.id,
    url: signed.get(photo.storagePath) ?? null,
    thumbnailUrl: photo.thumbnailPath
      ? (signed.get(photo.thumbnailPath) ?? null)
      : null,
  }));
}

export async function getJournalDetail(userId: string, journalId: string) {
  const membership = await getCurrentMembership(userId);

  if (!membership) {
    throw new JournalError("NO_MEMBERSHIP", "센터에 소속되어 있지 않아요.");
  }

  const journal = await prisma.journal.findFirst({
    where: {
      id: journalId,
      memberMembershipId: membership.id,
      status: JournalStatus.PUBLISHED,
    },
    select: {
      id: true,
      date: true,
      title: true,
      content: true,
      workoutSummary: true,
      dietGuidance: true,
      caution: true,
      nextGoal: true,
      memberReadAt: true,
      trainerMembership: {
        select: { id: true, user: { select: { name: true } } },
      },
      photos: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, storagePath: true, thumbnailPath: true },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          authorMembershipId: true,
          authorMembership: {
            select: { role: true, user: { select: { name: true } } },
          },
        },
      },
      ptSession: {
        select: {
          scheduledAt: true,
          workoutSession: {
            select: {
              id: true,
              records: {
                orderBy: { orderIndex: "asc" },
                select: {
                  id: true,
                  exercise: { select: { id: true, name: true } },
                  sets: {
                    orderBy: { setNumber: "asc" },
                    select: {
                      id: true,
                      setNumber: true,
                      weight: true,
                      reps: true,
                      completed: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!journal) {
    throw new JournalError("NOT_FOUND", "알림장을 찾을 수 없어요.");
  }

  if (journal.memberReadAt === null) {
    await prisma.journal.update({
      where: { id: journal.id },
      data: { memberReadAt: new Date() },
    });
  }

  const workoutSession = journal.ptSession?.workoutSession ?? null;
  const photos = await withSignedUrls(journal.photos);

  return {
    ...journal,
    photos,
    myMembershipId: membership.id,
    workout:
      workoutSession === null
        ? null
        : {
            id: workoutSession.id,
            records: workoutSession.records.map((record) => ({
              id: record.id,
              exercise: record.exercise,
              sets: record.sets.map((set) => ({
                ...set,
                weight: set.weight === null ? null : Number(set.weight),
              })),
            })),
          },
  };
}

export async function addJournalComment(
  userId: string,
  journalId: string,
  content: string,
) {
  const membership = await getCurrentMembership(userId);

  if (!membership) {
    throw new JournalError("NO_MEMBERSHIP", "센터에 소속되어 있지 않아요.");
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    throw new JournalError("EMPTY", "내용을 입력해주세요.");
  }
  if (trimmed.length > 1000) {
    throw new JournalError("TOO_LONG", "1000자까지 쓸 수 있어요.");
  }

  /**
   * 회원 본인이거나 담당 트레이너만 쓴다.
   *
   * 알림장 id 만 알면 남의 대화에 끼어들 수 있으므로 서버에서 반드시 본다.
   */
  const journal = await prisma.journal.findFirst({
    where: {
      id: journalId,
      status: JournalStatus.PUBLISHED,
      OR: [
        { memberMembershipId: membership.id },
        { trainerMembershipId: membership.id },
      ],
    },
    select: { id: true },
  });

  if (!journal) {
    throw new JournalError("NOT_FOUND", "알림장을 찾을 수 없어요.");
  }

  return prisma.journalComment.create({
    data: {
      journalId: journal.id,
      authorMembershipId: membership.id,
      content: trimmed,
    },
    select: { id: true },
  });
}

export async function getNoticeDetail(userId: string, noticeId: string) {
  const membership = await getCurrentMembership(userId);

  if (!membership) {
    throw new JournalError("NO_MEMBERSHIP", "센터에 소속되어 있지 않아요.");
  }

  const notice = await prisma.notice.findFirst({
    where: { id: noticeId, ...noticeVisibility(membership) },
    select: {
      id: true,
      title: true,
      content: true,
      publishedAt: true,
      pinnedAt: true,
      authorMembership: {
        select: { role: true, user: { select: { name: true } } },
      },
    },
  });

  if (!notice) {
    throw new JournalError("NOT_FOUND", "공지를 찾을 수 없어요.");
  }

  // 두 번 열어도 처음 읽은 시각을 유지한다.
  await prisma.noticeRead.upsert({
    where: {
      noticeId_membershipId: {
        noticeId: notice.id,
        membershipId: membership.id,
      },
    },
    create: { noticeId: notice.id, membershipId: membership.id },
    update: {},
  });

  return notice;
}
