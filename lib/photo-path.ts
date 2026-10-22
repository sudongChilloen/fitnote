/**
 * 알림장 사진의 저장소 경로 모양.
 *
 * createPhotoUpload 가 `journals/{알림장}/{uuid}.webp` 와 `...-thumb.webp` 만
 * 만든다. 붙이는 요청은 따로 들어오므로, 접두사만 보지 않고 이 모양과 정확히
 * 맞는 것만 받는다. 접두사만 보면 `../` 가 낀 경로도 통과한다.
 */
export function isJournalPhotoPath(
  journalId: string,
  path: string,
  kind: "full" | "thumb",
) {
  const escaped = journalId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = kind === "thumb" ? "-thumb" : "";

  return new RegExp(`^journals/${escaped}/[0-9a-f-]{36}${suffix}\\.webp$`).test(
    path,
  );
}
