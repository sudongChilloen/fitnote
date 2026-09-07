"use client";

import { useActionState } from "react";

import { saveJournalAction, type SaveState } from "../actions";

interface SessionOption {
  id: string;
  scheduledAt: string;
  sessionNumber: number;
  hasWorkout: boolean;
}

interface Props {
  journalId: string;
  status: "DRAFT" | "PUBLISHED";
  ptSessionId: string | null;
  title: string;
  content: string;
  workoutSummary: string;
  dietGuidance: string;
  caution: string;
  nextGoal: string;
  sessionOptions: SessionOption[];
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const boxClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[15px]";

/**
 * 알림장 작성.
 *
 * 저장(초안)과 게시를 한 폼에 둔다. 버튼마다 폼을 나누면 방금 친 내용이 다른 폼에
 * 들어 있어서 저장 버튼을 눌렀을 때 사라진다.
 *
 * 사진은 이 폼 밖에 있다. 파일은 저장소로 바로 올라가고 알림장에는 이미 붙어 있어서,
 * 여기서 같이 보낼 이유가 없다.
 */
export function JournalForm(props: Props) {
  const [state, formAction, pending] = useActionState<
    SaveState | undefined,
    FormData
  >(saveJournalAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="journalId" value={props.journalId} />

      {props.sessionOptions.length > 0 ? (
        <Field
          label="PT 수업 연결"
          hint="연결하면 그날 운동 기록이 함께 보여요."
        >
          <select
            name="ptSessionId"
            defaultValue={props.ptSessionId ?? ""}
            className={boxClass}
          >
            <option value="">연결 안 함</option>
            {props.sessionOptions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.scheduledAt} · {session.sessionNumber}회차
                {session.hasWorkout ? " (운동 기록 있음)" : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input
          type="hidden"
          name="ptSessionId"
          value={props.ptSessionId ?? ""}
        />
      )}

      <Field label="제목" hint="비워 두면 날짜로 보여요.">
        <input
          name="title"
          maxLength={100}
          defaultValue={props.title}
          placeholder="9월 7일 하체 PT"
          className={boxClass}
        />
      </Field>

      <Field label="오늘 수업">
        <textarea
          name="content"
          rows={5}
          maxLength={5000}
          defaultValue={props.content}
          placeholder="오늘은 하체 위주로 진행했습니다."
          className={boxClass}
        />
      </Field>

      <Field label="운동 정리" hint="중량과 횟수처럼 기억해 둘 것.">
        <textarea
          name="workoutSummary"
          rows={3}
          maxLength={2000}
          defaultValue={props.workoutSummary}
          placeholder="스쿼트 60kg 10회 3세트"
          className={boxClass}
        />
      </Field>

      <Field label="식단 안내">
        <textarea
          name="dietGuidance"
          rows={2}
          maxLength={2000}
          defaultValue={props.dietGuidance}
          className={boxClass}
        />
      </Field>

      <Field label="주의할 점">
        <textarea
          name="caution"
          rows={2}
          maxLength={2000}
          defaultValue={props.caution}
          className={boxClass}
        />
      </Field>

      <Field label="다음 목표">
        <textarea
          name="nextGoal"
          rows={2}
          maxLength={2000}
          defaultValue={props.nextGoal}
          className={boxClass}
        />
      </Field>

      {state?.error ? (
        <p className="text-sm font-medium text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2.5">
        <button
          type="submit"
          name="publish"
          value="0"
          disabled={pending}
          className="h-12 flex-1 rounded-xl border border-border font-bold disabled:opacity-50"
        >
          임시 저장
        </button>
        <button
          type="submit"
          name="publish"
          value="1"
          disabled={pending}
          className="h-12 flex-1 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
        >
          {props.status === "PUBLISHED" ? "수정 반영" : "게시하기"}
        </button>
      </div>

      {state?.savedAt ? (
        <p className="text-center text-xs text-muted-foreground">
          임시 저장했어요. 아직 회원에게는 보이지 않아요.
        </p>
      ) : null}
    </form>
  );
}
