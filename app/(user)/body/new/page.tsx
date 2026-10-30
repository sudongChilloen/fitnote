import { PageHeader } from "@/components/layout/page-header";

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
    <main className="pb-16">
      <PageHeader backHref="/body" backLabel="체성분으로" title="오늘 잰 몸" />
      <div className="px-4 pt-1.5">
      <p className="mx-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
        아는 것만 채우면 돼요. 같은 날 다시 적으면 덮어써요.
      </p>

      {message ? (
        <p className="mt-3 rounded-[0.875rem] bg-status-urgent-bg px-4 py-3 text-xs font-medium text-status-urgent">
          {message}
        </p>
      ) : null}

      <form action={saveBodyRecordAction} className="mt-4 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="mx-1 text-[0.8125rem] font-bold">날짜</span>
          <input
            name="dateKey"
            type="date"
            defaultValue={today}
            max={today}
            required
            className="h-12 rounded-2xl border border-border bg-card px-3.5 text-base outline-none focus:border-[1.5px] focus:border-primary"
          />
        </label>

        {FIELDS.map((field) => {
          const previous = last?.[field.name] ?? null;

          return (
            <label key={field.name} className="flex flex-col gap-1.5">
              <span className="mx-1 text-[0.8125rem] font-bold">
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
                className="h-12 rounded-2xl border border-border bg-card px-3.5 text-base outline-none focus:border-[1.5px] focus:border-primary tabular-nums"
              />
            </label>
          );
        })}

        <label className="flex flex-col gap-1.5">
          <span className="mx-1 text-[0.8125rem] font-bold">
            메모{" "}
            <span className="font-medium text-muted-foreground">(선택)</span>
          </span>
          <textarea
            name="memo"
            rows={2}
            maxLength={300}
            placeholder="아침 공복 / 운동 후 같은 조건을 적어두면 나중에 비교하기 좋아요"
            className="resize-none rounded-2xl border border-border bg-card px-3.5 py-3 text-base outline-none focus:border-[1.5px] focus:border-primary"
          />
        </label>

        <SaveButton className="mt-2">저장하기</SaveButton>
      </form>
      </div>
    </main>
  );
}
