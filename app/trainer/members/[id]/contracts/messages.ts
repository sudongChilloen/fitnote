/*
  PT 처리 실패 문구.

  서버 액션은 실패를 주소에 코드로만 싣는다. 서버가 만든 문장을 주소로 나르면
  주소창에 넣은 아무 문장이나 우리 화면에서 우리 말투로 뜬다.

  "use server" 파일은 함수만 내보낼 수 있어 표는 여기에 따로 둔다.
*/
export type PTFail =
  | "invalid"
  | "not_found"
  | "contract_closed"
  | "session_closed"
  | "no_sessions_left"
  | "unknown";

export const PT_ERROR_MESSAGE: Record<PTFail, string> = {
  invalid: "입력한 값을 확인해주세요.",
  not_found: "찾을 수 없어요.",
  contract_closed: "진행 중인 계약이 아니에요.",
  session_closed: "이미 처리한 수업이에요. 되돌린 뒤에 다시 해주세요.",
  no_sessions_left: "남은 횟수가 없어요.",
  unknown: "처리하지 못했어요. 잠시 후 다시 시도해주세요.",
};

/** 주소로 온 값이 우리가 아는 코드일 때만 문구를 고른다. */
export function ptErrorMessage(raw: string | string[] | undefined) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  return PT_ERROR_MESSAGE[raw as PTFail] ?? PT_ERROR_MESSAGE.unknown;
}
