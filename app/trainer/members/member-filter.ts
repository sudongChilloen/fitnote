/**
 * 회원 목록의 업무 중심 필터.
 *
 * 필터 규칙은 화면과 분리해 순수 함수로 검증할 수 있게 유지한다.
 */
export const MEMBER_FILTERS = [
  { key: "all", label: "전체" },
  { key: "attention", label: "확인 필요" },
  { key: "soon", label: "PT 만료 임박" },
] as const;

export type MemberFilter = (typeof MEMBER_FILTERS)[number]["key"];

/** 주소에서 온 값이 유효하지 않으면 전체로 되돌린다. */
export function parseMemberFilter(raw: unknown): MemberFilter {
  return MEMBER_FILTERS.some((filter) => filter.key === raw)
    ? (raw as MemberFilter)
    : "all";
}
