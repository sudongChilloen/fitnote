import "server-only";

import { prisma } from "@/lib/prisma";
import { MEAL_LABEL } from "@/server/diet/diet.service";
import { JournalStatus } from "@/generated/prisma/enums";
import { getCurrentMembership } from "@/server/centers/center.service";
import { noticeVisibility, activeTrainerUserIds } from "./journal-shared";

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
    }
  | {
      kind: "DIET";
      id: string;
      date: Date;
      title: string;
      preview: string;
      /** 피드백을 남긴 트레이너. 아직 없으면 null. */
      authorName: string | null;
      feedbackCount: number;
    };

function preview(text: string, length = 60) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}...` : flat;
}

/**
 * 알림장 · 공지 · 내 운동을 한 줄로 섞은 목록.
 *
 * 알림장만 모아 두면 화면이 자주 빈다. PT 는 주 두어 번인데 앱은 매일 열기
 * 때문이다. 개인 운동까지 함께 흐르면 그 사이가 메워진다.
 */
export async function getTimeline(userId: string, limit = 30) {
  const [membership, trainerUserIds] = await Promise.all([
    getCurrentMembership(userId),
    activeTrainerUserIds(userId),
  ]);

  const [journals, notices, sessions, diets] = await Promise.all([
    prisma.journal.findMany({
      where: {
        memberUserId: userId,
        status: JournalStatus.PUBLISHED,
      },
      select: {
        id: true,
        date: true,
        title: true,
        content: true,
        memberReadAt: true,
        trainerProfile: {
          select: { displayName: true, user: { select: { name: true } } },
        },
        _count: { select: { photos: true, comments: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
    }),
    membership
      ? prisma.notice.findMany({
          where: noticeVisibility(membership, trainerUserIds),
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
    prisma.dietRecord.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        date: true,
        mealType: true,
        foodName: true,
        memo: true,
        imagePath: true,
        feedbacks: {
          orderBy: { createdAt: "desc" },
          select: {
            createdAt: true,
            trainerProfile: {
              select: { displayName: true, user: { select: { name: true } } },
            },
          },
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
      authorName:
        journal.trainerProfile.displayName ?? journal.trainerProfile.user.name,
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
    /*
      식단과 그 피드백.

      회원이 올린 것도 같은 흐름에 놓아야 알림장이 "트레이너가 쓰는 게시판" 이
      아니라 양쪽이 오가는 곳이 된다. 피드백을 별도 줄로 만들지 않고 식단 줄에
      붙이는 이유는, 한 식단에 댓글이 셋 달리면 같은 사진이 네 번 나오기 때문이다.

      피드백이 달렸으면 줄의 날짜를 피드백 시각으로 올린다. 사흘 전 식단에 오늘
      답이 달렸는데 사흘 전 자리에 그대로 있으면 아무도 못 본다.
    */
    ...diets.map((diet): TimelineEntry => {
      const latest = diet.feedbacks[0];
      const body = diet.foodName ?? diet.memo;

      return {
        kind: "DIET",
        id: diet.id,
        date: latest ? latest.createdAt : diet.date,
        title: `${MEAL_LABEL[diet.mealType]} 식단`,
        preview: body
          ? preview(body)
          : diet.imagePath
            ? "사진만 남겼어요"
            : "내용 없이 끼니만 남겼어요",
        authorName: latest
          ? (latest.trainerProfile.displayName ??
            latest.trainerProfile.user.name)
          : null,
        feedbackCount: diet.feedbacks.length,
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
      (entry) =>
        entry.kind !== "WORKOUT" && entry.kind !== "DIET" && entry.unread,
    ).length,
    entries: entries.slice(0, limit),
  };
}

/**
 * 홈에 띄울 "새로운 소식" 개수.
 *
 * getTimeline 은 알림장 · 공지 · 운동을 30개씩 끌어와 섞는다. 홈에서 필요한 건
 * 숫자 하나뿐이라 세는 것으로 끝낸다.
 *
 * 안 읽은 알림장과 공지를 따로 돌려준다. 합쳐서 "3" 이라고만 하면 눌러서 열기
 * 전까지 뭘 봐야 하는지 모른다.
 */
export async function getUnreadCounts(userId: string) {
  const [membership, trainerUserIds] = await Promise.all([
    getCurrentMembership(userId),
    activeTrainerUserIds(userId),
  ]);

  const [journals, notices] = await Promise.all([
    prisma.journal.count({
      where: {
        memberUserId: userId,
        status: JournalStatus.PUBLISHED,
        memberReadAt: null,
      },
    }),
    membership
      ? prisma.notice.count({
          where: {
            ...noticeVisibility(membership, trainerUserIds),
            // 읽음 표시가 하나도 없는 것만. 공지는 여러 사람이 보므로
            // "내 것" 만 걸러야 한다.
            reads: { none: { membershipId: membership.id } },
          },
        })
      : 0,
  ]);

  return { journals, notices, total: journals + notices };
}
