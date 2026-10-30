import { notFound } from "next/navigation";

import { UtensilsCrossed } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, toKstDateKey } from "@/lib/date";
import {
  DietError,
  getMyDietDetail,
  MEAL_LABEL,
} from "@/server/diet/diet.service";

import { deleteDietRecord } from "../actions";
import { DietSharingNotice } from "../diet-sharing-notice";
import { DeleteDietButton } from "./delete-diet-button";

export async function generateMetadata({ params }: PageProps<"/diet/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const diet = await getMyDietDetail(user.id, id);
    return { title: `${MEAL_LABEL[diet.mealType]} 식단 | FitNote` };
  } catch {
    return { title: "식단 | FitNote" };
  }
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function DietDetailPage({
  params,
}: PageProps<"/diet/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  let diet;
  try {
    diet = await getMyDietDetail(user.id, id);
  } catch (error) {
    // 남의 기록은 "권한 없음" 이 아니라 없는 것으로 다룬다.
    if (error instanceof DietError) notFound();
    throw error;
  }

  const dateKey = toKstDateKey(diet.date);

  return (
    <main className="mx-auto w-full max-w-md pb-28">
      <PageHeader
        backHref={`/diet?date=${dateKey}`}
        backLabel="식단으로"
        title={`${MEAL_LABEL[diet.mealType]} 식단`}
        subtitle={formatKstDateLabel(diet.date)}
        right={
          <form action={deleteDietRecord}>
            <input type="hidden" name="id" value={diet.id} />
            <DeleteDietButton />
          </form>
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-1.5">
        {diet.imageUrl ? (
          // 서명 주소는 열 때마다 값이 달라 이미지 최적화 캐시가 매번 빗나간다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={diet.imageUrl}
            alt={diet.foodName ?? "식단 사진"}
            className="aspect-square w-full rounded-[1.375rem] bg-line object-cover"
          />
        ) : diet.hasPhoto ? (
          <p className="flex aspect-square w-full items-center justify-center rounded-[1.375rem] bg-surface text-xs text-muted-foreground">
            사진을 불러오지 못했어요
          </p>
        ) : null}

        <section className="rounded-[1.25rem] border border-border px-4 py-3.5">
          <span className="flex items-center gap-2">
            <span className="shrink-0 rounded-full border border-brand px-2 py-px text-[0.6875rem] font-bold text-primary">
              {MEAL_LABEL[diet.mealType]}
            </span>
            <b className="min-w-0 flex-1 truncate text-[0.9375rem]">
              {diet.foodName ?? (diet.hasPhoto ? "사진으로 남겼어요" : "내용 없이 끼니만 남겼어요")}
            </b>
          </span>
          {diet.memo ? (
            <p className="mt-2 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {diet.memo}
            </p>
          ) : null}
          {!diet.foodName && !diet.memo && !diet.hasPhoto ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <UtensilsCrossed className="size-4" aria-hidden />
              사진이나 메모가 없어요.
            </p>
          ) : null}
        </section>

        <DietSharingNotice userId={user.id} />

        <section className="mt-1">
          <h2 className="mx-1 mb-2 flex items-center gap-1.5 text-base font-extrabold">
            트레이너 피드백
            <span className="text-[0.8125rem] font-semibold text-muted-foreground tabular-nums">
              {diet.feedbacks.length}
            </span>
          </h2>

          {diet.feedbacks.length === 0 ? (
            <p className="rounded-[1.125rem] bg-[#f7f8f7] px-4 py-4 text-xs text-muted-foreground">
              아직 피드백이 없어요. 트레이너가 확인하면 여기에 남겨줘요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {diet.feedbacks.map((feedback) => (
                <li key={feedback.id} className="flex gap-2">
                  <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-extrabold text-primary">
                    {feedback.trainerName.trim().slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 rounded-[0.25rem_1rem_1rem_1rem] bg-brand-muted px-3 py-2.5">
                    <span className="block text-[0.6875rem] text-muted-foreground">
                      {feedback.trainerName} 트레이너 · {formatDateTime(feedback.createdAt)}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-normal whitespace-pre-wrap">
                      {feedback.content}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
