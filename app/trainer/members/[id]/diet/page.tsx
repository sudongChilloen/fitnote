import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ChevronLeft,
  ImageOff,
  Lock,
  MessageSquare,
  UtensilsCrossed,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { listMemberDiet } from "@/server/diet/diet-trainer.service";
import { MEAL_LABEL } from "@/server/diet/diet.service";
import {
  getSharingForTrainer,
  SharingError,
} from "@/server/sharing/sharing.service";
import {
  getMemberDetail,
  TrainerError,
} from "@/server/trainers/trainer.service";

export const metadata = { title: "회원 식단 | FitNote" };

export default async function TrainerMemberDietListPage({
  params,
}: PageProps<"/trainer/members/[id]/diet">) {
  const user = await requireUser();
  const { id } = await params;

  let member;
  try {
    member = await getMemberDetail(user.id, id);
  } catch (error) {
    if (error instanceof TrainerError) notFound();
    throw error;
  }

  // 공유 여부를 먼저 보고, 켜져 있을 때만 읽는다. 꺼져 있으면 조회 자체를 하지
  // 않으므로 "안 보여주는데 읽기는 했다" 는 상황이 생기지 않는다.
  const sharing = await getSharingForTrainer(user.id, id);

  let days: Awaited<ReturnType<typeof listMemberDiet>>["days"] = [];

  if (sharing.shareDiet) {
    try {
      ({ days } = await listMemberDiet(user.id, id, 40));
    } catch (error) {
      // 화면을 그리는 사이에 회원이 껐다면 잠금 안내로 떨어진다.
      if (!(error instanceof SharingError)) throw error;
      sharing.shareDiet = false;
    }
  }

  return (
    <main className="px-5 pt-5 pb-16">
      <Link
        href={`/trainer/members/${id}`}
        className="-ml-1 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {member.name}
      </Link>

      <h1 className="mt-2 text-xl font-bold">식단</h1>

      {!sharing.shareDiet ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-4">
          <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <Lock className="size-4" aria-hidden />
          </span>
          <p className="mt-2.5 text-sm font-bold">
            회원이 식단을 공유하지 않았어요
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            회원이 내 정보 &gt; 공유 설정에서 켜면 여기에 나타나요.
          </p>
        </div>
      ) : (
        <>
          {!sharing.shareDietPhoto ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
              <ImageOff className="mt-px size-3.5 shrink-0" aria-hidden />
              회원이 사진은 공유하지 않고 있어요. 적어 준 내용만 보여요.
            </p>
          ) : null}

          {days.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
              아직 올린 식단이 없어요.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              {days.map((day) => (
                <section key={day.dateKey}>
                  <h2 className="text-sm font-bold">
                    {formatKstDateLabel(
                      new Date(`${day.dateKey}T00:00:00+09:00`),
                    )}
                  </h2>

                  <ul className="mt-2 flex flex-col gap-2">
                    {day.records.map((record) => (
                      <li key={record.id}>
                        <Link
                          href={`/trainer/members/${id}/diet/${record.id}`}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                        >
                          {record.thumbnailUrl ? (
                            // 서명 주소는 열 때마다 값이 달라 최적화 캐시가 빗나간다.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={record.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="size-16 shrink-0 rounded-xl bg-secondary object-cover"
                            />
                          ) : (
                            <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                              {record.hasPhoto ? (
                                <ImageOff className="size-5" aria-hidden />
                              ) : (
                                <UtensilsCrossed
                                  className="size-5"
                                  aria-hidden
                                />
                              )}
                            </span>
                          )}

                          <span className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-brand-strong">
                              {MEAL_LABEL[record.mealType]}
                            </span>
                            <span className="mt-0.5 block truncate text-sm font-bold">
                              {record.foodName ??
                                record.memo ??
                                "사진만 올렸어요"}
                            </span>
                            <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              {record.feedbackCount > 0 ? (
                                <>
                                  <MessageSquare
                                    className="size-3"
                                    aria-hidden
                                  />
                                  피드백 {record.feedbackCount}
                                </>
                              ) : (
                                "아직 피드백 없음"
                              )}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
