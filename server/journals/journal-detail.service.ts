import "server-only";

import { prisma } from "@/lib/prisma";
import { createSignedReadUrls } from "@/lib/storage";
import { JournalStatus, NotificationType } from "@/generated/prisma/enums";
import { getCurrentMembership } from "@/server/centers/center.service";
import { createNotification } from "@/server/notifications/notification.service";
import {
  JournalError,
  noticeVisibility,
  activeTrainerUserIds,
} from "./journal-shared";

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
  const journal = await prisma.journal.findFirst({
    where: {
      id: journalId,
      status: JournalStatus.PUBLISHED,
      OR: [{ memberUserId: userId }, { trainerProfile: { userId } }],
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
      memberUserId: true,
      trainerProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          user: { select: { name: true } },
        },
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
          authorUserId: true,
          author: { select: { name: true } },
        },
      },
      ptSession: {
        select: {
          scheduledAt: true,
          sessionNumber: true,
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

  const viewerRole =
    journal.memberUserId === userId
      ? "MEMBER"
      : journal.trainerProfile.userId === userId
        ? "TRAINER"
        : null;

  if (viewerRole === "MEMBER" && journal.memberReadAt === null) {
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
    myUserId: userId,
    viewerRole,
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
      OR: [{ memberUserId: userId }, { trainerProfile: { userId } }],
    },
    select: {
      id: true,
      memberUserId: true,
      memberUser: { select: { name: true } },
      trainerProfile: {
        select: {
          userId: true,
          displayName: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!journal) {
    throw new JournalError("NOT_FOUND", "알림장을 찾을 수 없어요.");
  }

  const isMemberComment = journal.memberUserId === userId;

  return prisma.$transaction(async (tx) => {
    const comment = await tx.journalComment.create({
      data: {
        journalId: journal.id,
        authorUserId: userId,
        content: trimmed,
      },
      select: { id: true },
    });

    if (isMemberComment) {
      await createNotification(tx, {
        userId: journal.trainerProfile.userId,
        type: NotificationType.GENERAL,
        title: "회원 댓글이 달렸어요",
        message: `${journal.memberUser.name} 회원이 알림장에 댓글을 남겼어요.`,
        relatedType: "JOURNAL_COMMENT",
        relatedId: journal.id,
      });
    } else {
      /*
        트레이너가 단 댓글도 회원에게 알린다.

        회원은 알림장을 다시 열어 보기 전에는 답이 왔는지 알 수 없다. 알림이 가는
        곳은 회원 화면이므로 relatedType 을 JOURNAL 로 해서 /journal/{id} 로 연결한다
        (JOURNAL_COMMENT 는 트레이너 화면으로 가는 주소다).
      */
      await createNotification(tx, {
        userId: journal.memberUserId,
        type: NotificationType.GENERAL,
        title: "알림장에 댓글이 달렸어요",
        message: `${
          journal.trainerProfile.displayName ?? journal.trainerProfile.user.name
        } 트레이너가 알림장에 댓글을 남겼어요.`,
        relatedType: "JOURNAL",
        relatedId: journal.id,
      });
    }

    return comment;
  });
}

export async function getNoticeDetail(userId: string, noticeId: string) {
  const membership = await getCurrentMembership(userId);

  if (!membership) {
    throw new JournalError("NO_MEMBERSHIP", "센터에 소속되어 있지 않아요.");
  }

  const notice = await prisma.notice.findFirst({
    where: {
      id: noticeId,
      ...noticeVisibility(membership, await activeTrainerUserIds(userId)),
    },
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

export async function getTrainerJournalComments(
  userId: string,
  journalId: string,
) {
  const journal = await prisma.journal.findFirst({
    where: {
      id: journalId,
      status: JournalStatus.PUBLISHED,
      trainerProfile: {
        userId,
      },
    },
    select: {
      id: true,
      memberUser: {
        select: {
          name: true,
        },
      },
      comments: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          authorUserId: true,
          author: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!journal) {
    throw new JournalError("NOT_FOUND", "알림장을 찾을 수 없어요.");
  }

  return {
    journalId: journal.id,
    memberName: journal.memberUser.name,
    comments: journal.comments,
  };
}
