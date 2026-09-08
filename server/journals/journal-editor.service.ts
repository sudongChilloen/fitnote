import "server-only";

import { randomUUID } from "node:crypto";

import { JournalStatus } from "@/generated/prisma/enums";
import { kstStartOfDay } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  createSignedReadUrls,
  createSignedUpload,
  removeObjects,
} from "@/lib/storage";
import {
  requireMyMember,
  requireMyMemberByUserId,
  requireTrainerProfile,
  TrainerError,
} from "@/server/trainers/trainer.service";

/** 알림장 한 개에 붙일 수 있는 사진 수. */
export const MAX_PHOTOS = 10;

/** 브라우저에서 줄여 올리므로 이보다 커질 일이 없다. 넘으면 줄이기를 건너뛴 것이다. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = ["image/webp", "image/jpeg", "image/png"];

export class JournalEditError extends Error {
  constructor(
    readonly code:
      "NOT_FOUND" | "NOT_MINE" | "INVALID" | "TOO_MANY_PHOTOS" | "PUBLISHED",
    message: string,
  ) {
    super(message);
    this.name = "JournalEditError";
  }
}

/**
 * 내가 쓴 알림장인지 확인한다.
 *
 * 담당 회원이 맞는지까지 본다. 담당이 바뀐 뒤에도 예전 트레이너가 자기가 쓴 알림장을
 * 고칠 수 있으면, 회원은 지금 담당이 아닌 사람의 글이 바뀌는 걸 보게 된다.
 */
async function requireMyJournal(userId: string, journalId: string) {
  const trainer = await requireTrainerProfile(userId);

  const journal = await prisma.journal.findFirst({
    where: { id: journalId, trainerProfileId: trainer.id },
    select: {
      id: true,
      status: true,
      memberUserId: true,
      ptSessionId: true,
    },
  });

  if (!journal) {
    throw new JournalEditError("NOT_FOUND", "알림장을 찾을 수 없어요.");
  }

  const connection = await requireMyMemberByUserId(
    trainer.id,
    journal.memberUserId,
  );

  return { trainer, journal, connection };
}

/**
 * 알림장 쓰기를 시작한다.
 *
 * 사진을 올리려면 저장할 곳이 먼저 있어야 해서 초안을 만들고 시작한다. 눌렀다가
 * 그냥 나가면 빈 초안이 쌓이므로, 같은 수업(수업이 없으면 같은 날짜)의 초안이 이미
 * 있으면 그걸 다시 연다.
 */
export async function startJournal(
  userId: string,
  connectionId: string,
  ptSessionId?: string,
) {
  const trainer = await requireTrainerProfile(userId);
  const member = await requireMyMember(trainer.id, connectionId);

  let date = kstStartOfDay();

  if (ptSessionId) {
    const session = await prisma.pTSession.findFirst({
      where: {
        id: ptSessionId,
        trainerProfileId: trainer.id,
        memberUserId: member.memberUserId,
      },
      select: { id: true, scheduledAt: true },
    });

    if (!session) {
      throw new JournalEditError("INVALID", "그 수업을 찾을 수 없어요.");
    }

    date = session.scheduledAt;
  }

  const existing = await prisma.journal.findFirst({
    where: {
      trainerProfileId: trainer.id,
      memberUserId: member.memberUserId,
      status: JournalStatus.DRAFT,
      ...(ptSessionId
        ? { ptSessionId }
        : {
            ptSessionId: null,
            date: {
              gte: kstStartOfDay(),
              lt: new Date(kstStartOfDay().getTime() + 86_400_000),
            },
          }),
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.journal.create({
    data: {
      memberUserId: member.memberUserId,
      trainerProfileId: trainer.id,
      ptSessionId: ptSessionId ?? null,
      date,
      content: "",
      status: JournalStatus.DRAFT,
    },
    select: { id: true },
  });

  return created.id;
}

export interface JournalDraft {
  id: string;
  memberUserId: string;
  connectionId: string;
  memberName: string;
  date: Date;
  title: string | null;
  content: string;
  workoutSummary: string | null;
  dietGuidance: string | null;
  caution: string | null;
  nextGoal: string | null;
  status: JournalStatus;
  ptSessionId: string | null;
  readByMember: boolean;
  photos: { id: string; url: string | null }[];
  /** 연결할 수 있는 수업. 이미 다른 알림장이 붙은 수업은 빠진다. */
  sessionOptions: {
    id: string;
    scheduledAt: Date;
    sessionNumber: number;
    hasWorkout: boolean;
  }[];
}

export async function getJournalDraft(
  userId: string,
  journalId: string,
): Promise<JournalDraft> {
  const { trainer, connection } = await requireMyJournal(userId, journalId);

  const journal = await prisma.journal.findUniqueOrThrow({
    where: { id: journalId },
    select: {
      id: true,
      date: true,
      title: true,
      content: true,
      workoutSummary: true,
      dietGuidance: true,
      caution: true,
      nextGoal: true,
      status: true,
      ptSessionId: true,
      memberReadAt: true,
      memberUserId: true,
      memberUser: { select: { name: true } },
      photos: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, storagePath: true, thumbnailPath: true },
      },
    },
  });

  const sessions = await prisma.pTSession.findMany({
    where: {
      trainerProfileId: trainer.id,
      memberUserId: journal.memberUserId,
      // 두 달 치만 고르게 한다. 목록이 길어지면 고르기가 더 어렵다.
      scheduledAt: { gte: new Date(Date.now() - 60 * 86_400_000) },
      OR: [{ journals: { none: {} } }, { id: journal.ptSessionId ?? "" }],
    },
    orderBy: { scheduledAt: "desc" },
    take: 20,
    select: {
      id: true,
      scheduledAt: true,
      sessionNumber: true,
      workoutSession: { select: { id: true } },
    },
  });

  let signed = new Map<string, string>();
  try {
    signed = await createSignedReadUrls(
      journal.photos.map((photo) => photo.thumbnailPath ?? photo.storagePath),
    );
  } catch (error) {
    console.error("photo sign error:", error);
  }

  return {
    id: journal.id,
    memberUserId: journal.memberUserId,
    connectionId: connection.id,
    memberName: journal.memberUser.name,
    date: journal.date,
    title: journal.title,
    content: journal.content,
    workoutSummary: journal.workoutSummary,
    dietGuidance: journal.dietGuidance,
    caution: journal.caution,
    nextGoal: journal.nextGoal,
    status: journal.status,
    ptSessionId: journal.ptSessionId,
    readByMember: journal.memberReadAt !== null,
    photos: journal.photos.map((photo) => ({
      id: photo.id,
      url: signed.get(photo.thumbnailPath ?? photo.storagePath) ?? null,
    })),
    sessionOptions: sessions.map((session) => ({
      id: session.id,
      scheduledAt: session.scheduledAt,
      sessionNumber: session.sessionNumber,
      hasWorkout: session.workoutSession !== null,
    })),
  };
}

export interface SaveJournalInput {
  title?: string | null;
  content: string;
  workoutSummary?: string | null;
  dietGuidance?: string | null;
  caution?: string | null;
  nextGoal?: string | null;
  ptSessionId?: string | null;
  publish: boolean;
}

function clean(value: string | null | undefined, max: number) {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

/**
 * 저장한다. publish 가 참이면 게시까지 한다.
 *
 * 게시한 뒤에도 고칠 수 있게 뒀다. 오타 하나 때문에 지우고 새로 쓰면 회원이 단 댓글이
 * 함께 사라진다. 다만 게시한 글을 다시 초안으로 되돌리지는 않는다. 회원이 이미 읽은
 * 글이 목록에서 사라지는 게 더 이상하다.
 */
export async function saveJournal(
  userId: string,
  journalId: string,
  input: SaveJournalInput,
) {
  const { trainer, journal } = await requireMyJournal(userId, journalId);

  const content = input.content.trim();

  if (input.publish && content.length === 0) {
    throw new JournalEditError("INVALID", "내용을 적어주세요.");
  }

  let ptSessionId = journal.ptSessionId;

  if (input.ptSessionId !== undefined) {
    ptSessionId = input.ptSessionId;

    if (ptSessionId) {
      const session = await prisma.pTSession.findFirst({
        where: {
          id: ptSessionId,
          trainerProfileId: trainer.id,
          memberUserId: journal.memberUserId,
        },
        select: { id: true, scheduledAt: true },
      });

      if (!session) {
        throw new JournalEditError("INVALID", "그 수업을 찾을 수 없어요.");
      }
    }
  }

  const alreadyPublished = journal.status === JournalStatus.PUBLISHED;

  const updated = await prisma.journal.update({
    where: { id: journalId },
    data: {
      title: clean(input.title, 100),
      content: content.slice(0, 5000),
      workoutSummary: clean(input.workoutSummary, 2000),
      dietGuidance: clean(input.dietGuidance, 2000),
      caution: clean(input.caution, 2000),
      nextGoal: clean(input.nextGoal, 2000),
      ptSessionId,
      ...(input.publish && !alreadyPublished
        ? { status: JournalStatus.PUBLISHED, publishedAt: new Date() }
        : {}),
    },
    select: { id: true, status: true },
  });

  return updated;
}

/** 초안만 지운다. 게시한 글은 회원이 읽었을 수 있고 댓글이 달렸을 수 있다. */
export async function deleteJournalDraft(userId: string, journalId: string) {
  const { journal } = await requireMyJournal(userId, journalId);

  if (journal.status !== JournalStatus.DRAFT) {
    throw new JournalEditError(
      "PUBLISHED",
      "이미 게시한 알림장은 지울 수 없어요.",
    );
  }

  const photos = await prisma.journalPhoto.findMany({
    where: { journalId },
    select: { storagePath: true, thumbnailPath: true },
  });

  await prisma.journal.delete({ where: { id: journalId } });

  await removeObjects(
    photos.flatMap((photo) =>
      photo.thumbnailPath
        ? [photo.storagePath, photo.thumbnailPath]
        : [photo.storagePath],
    ),
  );
}

export interface UploadTicket {
  uploadUrl: string;
  path: string;
  thumbnailUploadUrl: string;
  thumbnailPath: string;
}

/**
 * 사진 한 장을 올릴 자리를 만든다.
 *
 * 경로를 서버가 정한다. 브라우저가 경로를 정하게 하면 남의 알림장 폴더에 올릴 수 있다.
 */
export async function createPhotoUpload(
  userId: string,
  journalId: string,
  mimeType: string,
): Promise<UploadTicket> {
  await requireMyJournal(userId, journalId);

  if (!ALLOWED_MIME.includes(mimeType)) {
    throw new JournalEditError("INVALID", "사진만 올릴 수 있어요.");
  }

  const count = await prisma.journalPhoto.count({ where: { journalId } });

  if (count >= MAX_PHOTOS) {
    throw new JournalEditError(
      "TOO_MANY_PHOTOS",
      `사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요.`,
    );
  }

  const key = randomUUID();
  const [full, thumb] = await Promise.all([
    createSignedUpload(`journals/${journalId}/${key}.webp`),
    createSignedUpload(`journals/${journalId}/${key}-thumb.webp`),
  ]);

  return {
    uploadUrl: full.uploadUrl,
    path: full.path,
    thumbnailUploadUrl: thumb.uploadUrl,
    thumbnailPath: thumb.path,
  };
}

/**
 * 다 올린 사진을 알림장에 붙인다.
 *
 * 경로를 그대로 믿지 않고 이 알림장의 폴더인지 확인한다. 서버가 만들어 준 경로만
 * 쓰도록 되어 있지만, 붙이는 요청은 따로 들어오므로 여기서도 봐야 한다.
 */
export async function attachPhoto(
  userId: string,
  journalId: string,
  storagePath: string,
  thumbnailPath: string | null,
) {
  await requireMyJournal(userId, journalId);

  const prefix = `journals/${journalId}/`;

  if (
    !storagePath.startsWith(prefix) ||
    (thumbnailPath !== null && !thumbnailPath.startsWith(prefix))
  ) {
    throw new JournalEditError("INVALID", "잘못된 사진 경로예요.");
  }

  const count = await prisma.journalPhoto.count({ where: { journalId } });

  if (count >= MAX_PHOTOS) {
    throw new JournalEditError(
      "TOO_MANY_PHOTOS",
      `사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요.`,
    );
  }

  return prisma.journalPhoto.create({
    data: { journalId, storagePath, thumbnailPath, orderIndex: count },
    select: { id: true },
  });
}

export async function removePhoto(
  userId: string,
  journalId: string,
  photoId: string,
) {
  await requireMyJournal(userId, journalId);

  const photo = await prisma.journalPhoto.findFirst({
    where: { id: photoId, journalId },
    select: { id: true, storagePath: true, thumbnailPath: true },
  });

  if (!photo) {
    throw new JournalEditError("NOT_FOUND", "사진을 찾을 수 없어요.");
  }

  await prisma.journalPhoto.delete({ where: { id: photo.id } });

  // 저장소에서도 지운다. DB 만 지우면 아무도 못 보는 파일에 요금이 계속 나간다.
  await removeObjects(
    photo.thumbnailPath
      ? [photo.storagePath, photo.thumbnailPath]
      : [photo.storagePath],
  );
}

export { TrainerError };
