import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { notFound } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { toKstDateKey } from "@/lib/date";
import {
  getMemberDetail,
  TrainerError,
} from "@/server/trainers/trainer.service";

import { createContractAction } from "../actions";
import { ptErrorMessage } from "../messages";
import { SubmitButton } from "../submit-button";

export const metadata = { title: "PT 계약 등록 | FitNote" };

export default async function NewContractPage({
  params,
  searchParams,
}: PageProps<"/trainer/members/[id]/contracts/new">) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;

  let member;
  try {
    member = await getMemberDetail(user.id, id);
  } catch (caught) {
    if (caught instanceof TrainerError) notFound();
    throw caught;
  }

  const today = toKstDateKey(new Date());
  const message = ptErrorMessage(error);

  return (
    <main className="pb-6">
      <PageHeader
        backHref={`/trainer/members/${id}`}
        backLabel={`${member.name} 회원 상세`}
        title="PT 계약 등록"
        subtitle={member.name}
      />
      <div className="px-4 pt-1.5">
      <p className="mx-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
        등록할 수업 횟수와 기간을 입력해주세요. 결제는 기존 방식대로 진행하면 돼요.
      </p>

      {message ? (
        <p className="mt-3 rounded-[0.875rem] bg-status-urgent-bg px-4 py-3 text-sm leading-relaxed text-status-urgent">
          {message}
        </p>
      ) : null}

      <form action={createContractAction} className="mt-3.5 flex flex-col gap-3">
        <input type="hidden" name="connectionId" value={id} />

        <section className="rounded-[1.375rem] border border-border p-4">
          <div className="mb-3.5">
            <h2 className="text-[0.9375rem] font-bold">계약 정보</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              계약의 기본 정보를 입력해주세요.
            </p>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-bold">총 수업 횟수</span>
            <div className="relative">
              <input
                name="totalSessions"
                type="number"
                min={1}
                max={200}
                defaultValue={10}
                required
                className="h-14 w-full rounded-2xl border border-border bg-background px-4 pr-16 text-lg font-semibold tabular-nums outline-none transition focus:border-[1.5px] focus:border-primary"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                회
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              1회부터 200회까지 등록할 수 있어요.
            </span>
          </label>
        </section>

        <section className="rounded-[1.375rem] border border-border p-4">
          <div className="mb-3.5">
            <h2 className="text-[0.9375rem] font-bold">계약 기간</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              시작일과 필요에 따라 만료일을 설정해주세요.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-bold">시작일</span>
              <input
                name="startedAt"
                type="date"
                defaultValue={today}
                required
                className="h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-[1.5px] focus:border-primary"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-bold">
                만료일{" "}
                <span className="font-normal text-muted-foreground">
                  (선택)
                </span>
              </span>
              <input
                name="expiresAt"
                type="date"
                className="h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-[1.5px] focus:border-primary"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                만료일을 비워두면 기간 제한 없이 관리할 수 있어요.
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-[1.375rem] border border-border p-4">
          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-bold">
              계약 이름{" "}
              <span className="font-normal text-muted-foreground">(선택)</span>
            </span>
            <input
              name="title"
              type="text"
              maxLength={60}
              placeholder="예: PT 10회"
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-[1.5px] focus:border-primary"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              입력하지 않으면 기본 계약 이름이 사용돼요.
            </span>
          </label>
        </section>

        <div className="mt-1 flex flex-col gap-3">
          <SubmitButton className="h-12.5 w-full rounded-full text-[0.9375rem] font-extrabold">
            계약 등록하기
          </SubmitButton>

          <Link
            href={`/trainer/members/${id}`}
            className="flex h-11 items-center justify-center rounded-full text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface"
          >
            취소
          </Link>
        </div>
      </form>
      </div>
    </main>
  );
}
