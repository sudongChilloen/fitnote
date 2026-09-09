import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { toKstDateKey } from "@/lib/date";
import { listBodyRecords, METRIC } from "@/server/body/body.service";

import { saveBodyRecordAction } from "../actions";
import { bodyErrorMessage } from "../messages";
import { SaveButton } from "../save-button";

export const metadata = { title: "체성분 기록 | FitNote" };

const FIELDS = [
  {
    name: "weightKg",
    label: METRIC.WEIGHT.label,
    unit: METRIC.WEIGHT.unit,
  },
  {
    name: "bodyFatPercent",
    label: METRIC.BODY_FAT.label,
    unit: METRIC.BODY_FAT.unit,
  },
  {
    name: "skeletalMuscleKg",
    label: METRIC.MUSCLE_MASS.label,
    unit: METRIC.MUSCLE_MASS.unit,
  },
  { name: "waistCm", label: "허리둘레", unit: "cm" },
] as const;

export default async function NewBodyRecordPage({
  searchParams,
}: PageProps<"/body/new">) {
  const user = await requireUser();
  const { error } = await searchParams;

  const today = toKstDateKey(new Date());
  const [last] = await listBodyRecords(user.id, 1);

  const message = bodyErrorMessage(error);

  return (
    <main className="px-5 pt-8 pb-16">
      <Link
        href="/body"
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        체성분
      </Link>

      <h1 className="mt-3 text-xl font-bold">오늘 잰 몸</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        아는 것만 채우면 돼요. 같은 날 다시 적으면 덮어써요.
      </p>

      {message ? (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
          {message}
        </p>
      ) : null}

      <form action={saveBodyRecordAction} className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">날짜</span>
          <input
            name="dateKey"
            type="date"
            defaultValue={today}
            max={today}
            required
            className="h-12 rounded-xl border border-border bg-card px-4 text-base"
          />
        </label>

        {FIELDS.map((field) => {
          const previous = last?.[field.name] ?? null;

          return (
            <label key={field.name} className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">
                {field.label}{" "}
                <span className="font-medium text-muted-foreground">
                  ({field.unit})
                </span>
              </span>

              <input
                name={field.name}
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder={
                  previous === null ? "비워둬도 돼요" : `지난번 ${previous}`
                }
                className="h-12 rounded-xl border border-border bg-card px-4 text-base tabular-nums"
              />
            </label>
          );
        })}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">
            메모{" "}
            <span className="font-medium text-muted-foreground">(선택)</span>
          </span>
          <textarea
            name="memo"
            rows={2}
            maxLength={300}
            placeholder="아침 공복 / 운동 후 같은 조건을 적어두면 나중에 비교하기 좋아요"
            className="rounded-xl border border-border bg-card p-4 text-base"
          />
        </label>

        <SaveButton className="mt-2">저장하기</SaveButton>
      </form>
    </main>
  );
}
