/**
 * 회원 목록의 계약 필터.
 *
 * 화면 부품과 파일을 나눈 건 여기에 next/link 가 섞이면 검증 스크립트에서
 * 이 파일을 못 부르기 때문이다. 고르는 규칙은 화면 없이도 확인할 수 있어야
 * 한다.
 */
export const MEMBER_FILTERS = [
  { key: "all", label: "전체" },
  { key: "pt", label: "PT 중" },
  { key: "soon", label: "마감 임박" },
  { key: "none", label: "계약 없음" },
] as const;

export type MemberFilter = (typeof MEMBER_FILTERS)[number]["key"];

/** 주소에서 온 값은 뭐든 올 수 있다. 모르는 값이면 전체로 되돌린다. */
export function parseMemberFilter(raw: unknown): MemberFilter {
  return MEMBER_FILTERS.some((filter) => filter.key === raw)
    ? (raw as MemberFilter)
    : "all";
}
