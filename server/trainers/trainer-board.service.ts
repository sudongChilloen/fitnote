import "server-only";

/**
 * 트레이너가 시간과 할 일 축으로 보는 화면들.
 *
 * 기존 `trainer.service` 는 회원을 축으로 짠다(회원 → 계약 → 회차). 그건
 * 데이터를 저장한 모양이지 트레이너가 일하는 모양이 아니다. 트레이너는
 * "지금 뭘 해야 하지" 로 움직인다 — 다음 수업이 몇 시에 누구인지, 알림장을
 * 누구 것을 안 썼는지, 누가 답을 기다리는지.
 *
 * 그래서 같은 데이터를 시간축과 할 일 축으로 다시 세워 주는 파일을 따로 둔다.
 */

export { getTrainerMonth } from "./trainer-board-month.service";
export type {
  TrainerMonthDay,
  TrainerMonth,
} from "./trainer-board-month.service";
export type { TrainerSessionRow } from "./trainer-board-shared";
export { getTrainerTodos } from "./trainer-board-todos.service";
export type {
  TrainerReplyRow,
  TrainerTodos,
} from "./trainer-board-todos.service";
export { getTrainerWeek, getTrainerToday } from "./trainer-board-week.service";
export type { TrainerWeekDay, TrainerWeek } from "./trainer-board-week.service";
