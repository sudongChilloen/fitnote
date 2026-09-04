import * as z from "zod";

export const StartSessionSchema = z.object({
  routineId: z.uuid({ error: "올바른 루틴 ID가 아닙니다." }).optional(),
  memo: z.string().max(500, { error: "메모는 500자 이하로 입력해주세요." }).optional(),
  // ask: 진행중 세션이 있으면 409 로 알려준다 (사용자에게 물어보기 위함)
  mode: z.enum(["ask", "resume", "new"]).default("ask"),
});

export const UpdateSessionSchema = z.object({
  action: z.enum(["finish", "cancel", "memo"]),
  memo: z.string().max(500).nullish(),
});

export const AddRecordSchema = z.object({
  exerciseId: z.uuid({ error: "올바른 운동 ID가 아닙니다." }),
  note: z.string().max(500).optional(),
});

/**
 * 세트 입력.
 * 중량은 0 이상(맨몸 운동은 0), 횟수는 1 이상.
 * 상한을 두어 오타로 말도 안 되는 값이 통계에 섞이지 않게 한다.
 */
export const SetInputSchema = z.object({
  weight: z
    .number()
    .min(0, { error: "중량은 0 이상이어야 합니다." })
    .max(1000, { error: "중량이 너무 큽니다." })
    .nullish(),
  reps: z
    .number()
    .int({ error: "횟수는 정수여야 합니다." })
    .min(0, { error: "횟수는 0 이상이어야 합니다." })
    .max(1000, { error: "횟수가 너무 큽니다." })
    .nullish(),
  restSeconds: z.number().int().min(0).max(3600).nullish(),
  completed: z.boolean().optional(),
  rpe: z
    .number()
    .min(1, { error: "RPE 는 1~10 사이여야 합니다." })
    .max(10, { error: "RPE 는 1~10 사이여야 합니다." })
    .nullish(),
  note: z.string().max(300).nullish(),
});

export const ListSessionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
