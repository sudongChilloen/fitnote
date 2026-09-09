import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeft, MessageSquare, UtensilsCrossed } from "lucide-react";

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
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-28">
      <Link
        href={`/diet?date=${dateKey}`}
        className="-ml-1 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        식단
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand-strong">
            {MEAL_LABEL[diet.mealType]}
          </p>
          <h1 className="mt-0.5 text-xl font-bold">
            {formatKstDateLabel(diet.date)}
          </h1>
        </div>

        <form action={deleteDietRecord} className="shrink-0">
          <input type="hidden" name="id" value={diet.id} />
          <DeleteDietButton />
        </form>
      </div>

      {diet.imageUrl ? (
        // 서명 주소는 열 때마다 값이 달라 이미지 최적화 캐시가 매번 빗나간다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={diet.imageUrl}
          alt={diet.foodName ?? "식단 사진"}
          className="mt-4 aspect-square w-full rounded-2xl bg-secondary object-cover"
        />
      ) : diet.hasPhoto ? (
        <p className="mt-4 flex aspect-square w-full items-center justify-center rounded-2xl bg-secondary text-xs text-muted-foreground">
          사진을 불러오지 못했어요
        </p>
      ) : null}

      {diet.foodName ? (
        <p className="mt-4 text-base font-bold">{diet.foodName}</p>
      ) : null}

      {diet.memo ? (
        <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
          {diet.memo}
        </p>
      ) : null}

      {!diet.foodName && !diet.memo && !diet.hasPhoto ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <UtensilsCrossed className="size-4" aria-hidden />
          내용 없이 끼니만 남겼어요.
        </p>
      ) : null}

      <div className="mt-5">
        <DietSharingNotice userId={user.id} />
      </div>

      <section className="mt-7">
        <h2 className="flex items-center gap-1.5 text-base font-bold">
          <MessageSquare className="size-4" aria-hidden />
          트레이너 피드백
        </h2>

        {diet.feedbacks.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            아직 피드백이 없어요. 트레이너가 확인하면 여기에 남겨줘요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {diet.feedbacks.map((feedback) => (
              <li
                key={feedback.id}
                className="rounded-2xl border border-border bg-accent p-4"
              >
                <p className="text-xs font-bold text-brand-strong">
                  {feedback.trainerName} 트레이너
                </p>
                <p className="mt-1.5 text-sm whitespace-pre-wrap">
                  {feedback.content}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(feedback.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
