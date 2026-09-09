import { History } from "lucide-react";

import { BODY_PART_LABEL } from "@/lib/exercise-labels";
import { formatKstDateLabel } from "@/lib/date";
import type { WorkoutBodyPart } from "@/generated/prisma/enums";
import type { SessionBriefing } from "@/server/pt/session-record.service";

import { CopyPreviousExercisesButton } from "./copy-exercises-button";

/**
 * 지난번에 뭘 했는지.
 *
 * 회원이 문을 열고 들어오는 순간 트레이너가 떠올려야 하는 건 하나다 —
 * "지난주에 뭐 했지." 오늘 어느 부위를 할지도, 몇 kg부터 시작할지도 거기서
 * 나온다.
 *
 * 그래서 접어 두지 않는다. `<details>` 로 만들면 열어 봐야 하는 것이 되고,
 * 열어 봐야 하는 것은 바쁜 날 안 열어 본다. 대신 짧게 쓴다 — 운동 이름과
 * 지난번 최고 중량 한 줄씩이면 충분하다.
 *
 * 운동을 이미 담기 시작했으면 사라진다. 그때부터는 오늘 든 무게가 화면의
 * 주인공이고, 지난주 이야기가 위에 남아 있으면 오늘 숫자를 밀어낸다.
 */
export function Briefing({
  ptSessionId,
  briefing,
  canCopy,
}: {
  ptSessionId: string;
  briefing: SessionBriefing;
  /** 운동을 아직 안 담았을 때만 통째로 담기를 권한다. */
  canCopy: boolean;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-border bg-secondary/40 p-3.5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <History className="size-3.5" aria-hidden />
        지난 수업
        <span className="font-medium">
          {briefing.daysAgo === 0
            ? "오늘"
            : `${briefing.daysAgo}일 전`}
          {" · "}
          {formatKstDateLabel(briefing.performedAt)}
          {briefing.sessionNumber === null
            ? ""
            : ` · ${briefing.sessionNumber}회차`}
        </span>
      </h2>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {briefing.records.map((record) => (
          <li
            key={record.exerciseId}
            className="flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="min-w-0 truncate">
              <span className="mr-1.5 text-[0.6875rem] text-muted-foreground">
                {BODY_PART_LABEL[record.bodyPart as WorkoutBodyPart] ??
                  record.bodyPart}
              </span>
              <span className="font-semibold">{record.name}</span>
            </span>

            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {record.topWeight === null
                ? `${record.setCount}세트`
                : `${record.topWeight}kg × ${record.topReps ?? "-"} · ${record.setCount}세트`}
            </span>
          </li>
        ))}
      </ul>

      {canCopy ? (
        <div className="mt-3">
          <CopyPreviousExercisesButton ptSessionId={ptSessionId} />
        </div>
      ) : null}
    </section>
  );
}
