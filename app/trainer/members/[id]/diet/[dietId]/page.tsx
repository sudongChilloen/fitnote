import { PageHeader } from "@/components/layout/page-header";
import { notFound } from "next/navigation";

import {
  ImageOff,
  MessageSquare,
  UtensilsCrossed,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getMemberDietDetail } from "@/server/diet/diet-trainer.service";
import { DietError, MEAL_LABEL } from "@/server/diet/diet.service";
import { SharingError } from "@/server/sharing/sharing.service";
import { TrainerError } from "@/server/trainers/trainer.service";

import { removeDietFeedback, writeDietFeedback } from "../../../actions";
import { SubmitFeedbackButton } from "./submit-feedback-button";

export const metadata = { title: "회원 식단 | FitNote" };

const ERROR_TEXT: Record<string, string> = {
  empty: "피드백 내용을 적어주세요.",
  not_shared: "회원이 식단 공유를 껐어요.",
  unknown: "남기지 못했어요. 잠시 후 다시 시도해주세요.",
};

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

export default async function TrainerMemberDietPage({
  params,
  searchParams,
}: PageProps<"/trainer/members/[id]/diet/[dietId]">) {
  const user = await requireUser();
  const { id, dietId } = await params;
  const { error } = await searchParams;

  let data;
  try {
    data = await getMemberDietDetail(user.id, id, dietId);
  } catch (caught) {
    // 담당이 아니거나 공유가 꺼진 식단은 없는 것으로 다룬다. 목록에서 이미
    // 걸러지므로 여기까지 왔다면 그 사이에 회원이 껐거나 주소를 직접 친 것이다.
    if (
      caught instanceof TrainerError ||
      caught instanceof SharingError ||
      caught instanceof DietError
    ) {
      notFound();
    }
    throw caught;
  }

  const { detail, member, setting } = data;
  const message = typeof error === "string" ? ERROR_TEXT[error] : undefined;

  return (
    <main className="pb-6">
      <PageHeader
        backHref={`/trainer/members/${id}/diet`}
        backLabel={`${member.memberUser.name} 회원 식단`}
        title={`${member.memberUser.name} · ${MEAL_LABEL[detail.mealType]} 식단`}
        subtitle={formatKstDateLabel(detail.date)}
      />
      <div className="px-4 pt-1.5">

      {detail.imageUrl ? (
        // 서명 주소는 열 때마다 값이 달라 이미지 최적화 캐시가 매번 빗나간다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={detail.imageUrl}
          alt={detail.foodName ?? "식단 사진"}
          className="aspect-square w-full rounded-[1.375rem] bg-line object-cover"
        />
      ) : detail.hasPhoto && !setting.shareDietPhoto ? (
        <p className="flex items-center gap-2 rounded-[1.125rem] bg-[#f7f8f7] p-4 text-xs text-muted-foreground">
          <ImageOff className="size-4 shrink-0" aria-hidden />
          회원이 사진은 공유하지 않았어요.
        </p>
      ) : null}

      {detail.foodName ? (
        <p className="mx-1 mt-3.5 text-base font-bold">{detail.foodName}</p>
      ) : null}

      {detail.memo ? (
        <p className="mx-1 mt-1.5 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {detail.memo}
        </p>
      ) : null}

      {!detail.foodName && !detail.memo && !detail.hasPhoto ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <UtensilsCrossed className="size-4" aria-hidden />
          회원이 끼니만 남겼어요.
        </p>
      ) : null}

      <section className="mt-5">
        <h2 className="mx-1 flex items-center gap-1.5 text-base font-extrabold">
          <MessageSquare className="size-4" aria-hidden />
          피드백
        </h2>

        {detail.feedbacks.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {detail.feedbacks.map((feedback) => (
              <li
                key={feedback.id}
                className="rounded-[0.25rem_1rem_1rem_1rem] bg-brand-muted px-3.5 py-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-bold text-primary">
                    {feedback.trainerName} 트레이너
                  </p>

                  <form action={removeDietFeedback}>
                    <input type="hidden" name="memberMembershipId" value={id} />
                    <input type="hidden" name="dietId" value={dietId} />
                    <input
                      type="hidden"
                      name="feedbackId"
                      value={feedback.id}
                    />
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground"
                    >
                      삭제
                    </button>
                  </form>
                </div>

                <p className="mt-1.5 text-sm whitespace-pre-wrap">
                  {feedback.content}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(feedback.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {message ? (
          <p
            role="alert"
            className="mt-3 rounded-[0.875rem] bg-status-urgent-bg px-4 py-3 text-sm font-medium text-status-urgent"
          >
            {message}
          </p>
        ) : null}

        <form action={writeDietFeedback} className="mt-3">
          <input type="hidden" name="memberMembershipId" value={id} />
          <input type="hidden" name="dietId" value={dietId} />

          <label htmlFor="content" className="sr-only">
            피드백 내용
          </label>
          <textarea
            id="content"
            name="content"
            rows={3}
            maxLength={1000}
            placeholder="단백질 섭취량 좋아요. 저녁에는 채소를 조금 더 챙겨주세요."
            className="w-full resize-none rounded-2xl border border-border bg-card px-3.5 py-3 text-sm outline-none focus:border-[1.5px] focus:border-primary"
          />

          <SubmitFeedbackButton />
        </form>
      </section>
      </div>
    </main>
  );
}
