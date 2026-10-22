import "server-only";

import { JournalStatus, PTSessionStatus } from "@/generated/prisma/enums";
import { toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireTrainerProfile } from "./trainer.service";
import {
  TrainerSessionRow,
  sessionSelect,
  toRow,
  connectionMap,
  DAY_MS,
} from "./trainer-board-shared";

export interface TrainerReplyRow {
  journalId: string;
  date: Date;
  title: string | null;
  memberName: string;

  /** 마지막 회원 댓글 내용. 트레이너가 무엇에 답해야 하는지 바로 보여준다. */
  content: string;

  /** 아직 답하지 않은 회원 댓글 수. */
  count: number;

  lastCommentAt: Date;
}

export interface TrainerTodos {
  /**
   * 시간이 지났는데 아직 예정으로 남아 있는 수업.
   *
   * 완료를 누르는 순간 PT 횟수가 깎이므로 자동으로 처리하지 않는다. 회원이
   * 안 왔을 수도 있고, 30분만 하고 갔을 수도 있고, 봐주기로 했을 수도 있다.
   * 대신 안 누르고 지나간 것을 여기 올려 둔다 — 안 누르면 회원의 남은 횟수가
   * 실제와 어긋나기 시작하고, 그건 돈 문제라 조용히 틀어지면 안 된다.
   */
  needComplete: TrainerSessionRow[];

  /** 수업은 끝났는데 알림장을 아직 게시하지 않은 것. 최근 것부터. */
  needJournal: TrainerSessionRow[];

  /** 마지막 댓글이 회원 것이라 답을 기다리는 알림장. */
  awaitingReply: TrainerReplyRow[];
}

/** 두 달이 넘은 일은 이제 와서 하라고 띄우지 않는다. */
const TODO_WINDOW_DAYS = 60;

export async function getTrainerTodos(userId: string): Promise<TrainerTodos> {
  const trainer = await requireTrainerProfile(userId);

  const since = new Date(Date.now() - TODO_WINDOW_DAYS * DAY_MS);

  const [sessions, overdue, journals, byUser] = await Promise.all([
    prisma.pTSession.findMany({
      where: {
        trainerProfileId: trainer.id,

        // 노쇼와 취소는 적을 내용이 없다.
        // 완료한 수업만 알림장을 기다린다.
        status: PTSessionStatus.COMPLETED,

        scheduledAt: {
          gte: since,
        },

        journals: {
          none: {
            status: JournalStatus.PUBLISHED,
          },
        },
      },

      orderBy: {
        scheduledAt: "desc",
      },

      select: sessionSelect,
    }),

    /*
        끝났어야 할 시간이 지난 예정 수업.

        `scheduledAt` 만으로 거르면 지금 진행 중인 수업까지
        "완료 안 함" 으로 올라온다.
        수업 길이를 더해 실제로 끝났을 시간을 넘긴 것만 센다.
      */
    prisma.pTSession.findMany({
      where: {
        trainerProfileId: trainer.id,
        status: PTSessionStatus.SCHEDULED,

        scheduledAt: {
          gte: since,
          lt: new Date(),
        },
      },

      orderBy: {
        scheduledAt: "desc",
      },

      select: sessionSelect,
    }),

    prisma.journal.findMany({
      where: {
        trainerProfileId: trainer.id,
        status: JournalStatus.PUBLISHED,

        date: {
          gte: since,
        },
      },

      orderBy: {
        date: "desc",
      },

      select: {
        id: true,
        date: true,
        title: true,

        memberUser: {
          select: {
            name: true,
          },
        },

        comments: {
          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,
            createdAt: true,
            authorUserId: true,
            content: true,
          },
        },
      },
    }),

    connectionMap(trainer.id),
  ]);

  const awaitingReply: TrainerReplyRow[] = [];

  for (const journal of journals) {
    /*
      마지막 댓글이 회원 것이면 답을 기다리는 중이다.
      읽음 표시를 따로 두지 않은 이유는, 트레이너에게 필요한 건
      "봤는가" 가 아니라 "답했는가" 라서다.
    */
    const [latest] = journal.comments;

    if (!latest || latest.authorUserId === trainer.userId) {
      continue;
    }

    // 가장 최근 트레이너 답변 이후에 온 회원 댓글만 센다.
    // 댓글 전체를 세면 예전 대화까지 다시 답해야 하는 것처럼 보인다.
    const latestMine = journal.comments.find(
      (comment) => comment.authorUserId === trainer.userId,
    );

    const count = journal.comments.filter(
      (comment) =>
        comment.authorUserId !== trainer.userId &&
        (!latestMine || comment.createdAt > latestMine.createdAt),
    ).length;

    awaitingReply.push({
      journalId: journal.id,
      date: journal.date,
      title: journal.title,
      memberName: journal.memberUser.name,
      content: String(latest.content ?? ""),
      count,
      lastCommentAt: latest.createdAt,
    });
  }

  awaitingReply.sort(
    (a, b) => b.lastCommentAt.getTime() - a.lastCommentAt.getTime(),
  );

  const now = Date.now();

  return {
    needComplete: overdue
      .filter(
        (session) =>
          session.scheduledAt.getTime() + session.durationMinutes * 60_000 <
          now,
      )
      .map((session) => toRow(session, byUser, toKstDateKey(new Date()))),

    needJournal: sessions.map((session) =>
      toRow(session, byUser, toKstDateKey(new Date())),
    ),

    awaitingReply,
  };
}
