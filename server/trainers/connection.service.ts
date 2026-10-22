import "server-only";

/**
 * 트레이너와 회원의 연결.
 *
 * 센터를 거치지 않는다. 프리랜서 트레이너도, 센터 소속 트레이너도 똑같이
 * 자기 코드를 뿌리고 회원이 그 코드를 넣으면 연결된다. 센터 코드는 소속만
 * 만들 뿐 이 관계에 관여하지 않는다.
 */

export {
  createPendingMember,
  createMemberClaimCode,
  getMemberClaimCode,
  previewMemberClaimCode,
  claimMemberAccount,
} from "./connection-claim.service";
export {
  startTrainerProfile,
  createTrainerInvitation,
  listActiveTrainerInvitations,
  revokeTrainerInvitation,
  redeemTrainerCode,
  endConnection,
  getMyTrainers,
} from "./connection-invite.service";
export { ConnectionError } from "./connection-shared";
