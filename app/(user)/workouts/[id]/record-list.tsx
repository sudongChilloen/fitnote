"use client";

import { Check, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { RecordCard, type PreviousRecord, type RecordDto } from "./record-card";

/**
 * 운동 카드 목록 + 수정 모드.
 *
 * 완료한 세션도 고칠 수 있게 열어 뒀다. "종료" 는 운동이 끝났다는 뜻이지
 * 데이터가 굳었다는 뜻이 아니고, 집에 와서 무게를 잘못 적은 걸 발견하는 일은
 * 흔하다.
 *
 * 다만 항상 입력칸을 띄워 두지는 않는다. 지난 기록을 훑어보다가 실수로
 * 값이 바뀌면 그게 더 나쁘다. "수정" 을 눌러야 편집이 열린다.
 *
 * 진행중인 세션은 지금 입력하는 중이므로 늘 열려 있다.
 */
export function RecordList({
  sessionId,
  records,
  previousRecords,
  alwaysEditable,
  addSlot,
}: {
  sessionId: string;
  records: RecordDto[];
  previousRecords: (PreviousRecord | null)[];
  alwaysEditable: boolean;
  /**
   * 운동 추가 UI. 진행중 세션은 페이지 아래에 따로 두고, 완료된 세션은
   * 수정 모드일 때만 보여준다. 서버에서 만든 노드를 그대로 꽂는다.
   */
  addSlot?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const editable = alwaysEditable || editing;

  return (
    <div className="flex flex-col gap-3">
      {alwaysEditable ? null : (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">
            운동 {records.length}개
            {editing ? (
              <span className="ml-2 font-medium text-brand-strong">
                수정 중
              </span>
            ) : null}
          </h2>

          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            className="rounded-lg font-bold"
            onClick={() => setEditing((prev) => !prev)}
          >
            {editing ? (
              <>
                <Check className="size-4" />
                수정 완료
              </>
            ) : (
              <>
                <Pencil className="size-4" />
                수정
              </>
            )}
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {records.map((record, index) => (
          <RecordCard
            key={record.id}
            sessionId={sessionId}
            editable={editable}
            record={record}
            previousRecord={previousRecords[index]}
          />
        ))}
      </ul>

      {!alwaysEditable && editing && addSlot ? addSlot : null}
    </div>
  );
}
