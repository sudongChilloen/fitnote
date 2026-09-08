import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeft } from "lucide-react";

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
    <main className="px-5 pt-5 pb-16">
      <Link
        href={`/trainer/members/${id}`}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {member.name}
      </Link>

      <h1 className="mt-3 text-xl font-bold">PT 계약 등록</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        결제는 하던 대로 하시고, 여기엔 횟수와 기간만 적어두세요.
      </p>

      {message ? (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
          {message}
        </p>
      ) : null}

      <form action={createContractAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="connectionId" value={id} />

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">총 횟수</span>
          <input
            name="totalSessions"
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            defaultValue={10}
            required
            className="h-12 rounded-xl border border-border bg-card px-4 text-base tabular-nums"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">시작일</span>
            <input
              name="startedAt"
              type="date"
              defaultValue={today}
              required
              className="h-12 rounded-xl border border-border bg-card px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">
              만료일{" "}
              <span className="font-medium text-muted-foreground">(선택)</span>
            </span>
            <input
              name="expiresAt"
              type="date"
              className="h-12 rounded-xl border border-border bg-card px-3 text-sm"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">
            이름{" "}
            <span className="font-medium text-muted-foreground">(선택)</span>
          </span>
          <input
            name="title"
            type="text"
            maxLength={60}
            placeholder="비워두면 'PT 10회' 로 적어둘게요"
            className="h-12 rounded-xl border border-border bg-card px-4 text-base"
          />
        </label>

        <SubmitButton className="mt-2">등록하기</SubmitButton>
      </form>
    </main>
  );
}
