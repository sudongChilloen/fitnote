import "server-only";

/**
 * PT 계약과 수업.
 *
 * FitNote 는 결제를 하지 않는다. 돈은 센터나 트레이너가 이미 따로 받는다.
 * 여기서 하는 일은 "몇 회를 언제까지 쓰는지" 와 "그 회차가 실제로 어떻게
 * 됐는지" 를 관리하는 것뿐이다.
 */

export {
  PTError,
  SESSION_STATUS_LABEL,
  CONTRACT_STATUS_LABEL,
  isExpired,
} from "./pt-shared";
export {
  createContract,
  extendContract,
  cancelContract,
  listContracts,
  listSchedulableContracts,
} from "./pt-contract.service";
export type { ContractSummary } from "./pt-contract.service";
export {
  scheduleSession,
  rescheduleSession,
  completeSession,
  markNoShow,
  cancelSession,
  reopenSession,
  listSessions,
} from "./pt-session.service";
export type { SessionRow } from "./pt-session.service";
export {
  getMyUpcomingSessions,
  acknowledgeSessionChange,
  getMyPt,
} from "./pt-member.service";
export type { MyPtSessionRow, MyPtContract } from "./pt-member.service";
