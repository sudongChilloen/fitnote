import { describe, expect, it } from "vitest";

import { isJournalPhotoPath } from "@/lib/photo-path";

const id = "7d9c1f0e-1111-4222-8333-444455556666";
const key = "123e4567-e89b-12d3-a456-426614174000";

describe("isJournalPhotoPath", () => {
  it("업로드가 만드는 경로를 받는다", () => {
    expect(isJournalPhotoPath(id, `journals/${id}/${key}.webp`, "full")).toBe(
      true,
    );
    expect(
      isJournalPhotoPath(id, `journals/${id}/${key}-thumb.webp`, "thumb"),
    ).toBe(true);
  });

  it("원본 자리에 썸네일 경로를 받지 않는다", () => {
    expect(
      isJournalPhotoPath(id, `journals/${id}/${key}-thumb.webp`, "full"),
    ).toBe(false);
  });

  it.each([
    ["다른 알림장", `journals/other/${key}.webp`],
    ["상위 경로", `journals/${id}/../x/${key}.webp`],
    ["uuid 아님", `journals/${id}/evil.webp`],
    ["확장자 다름", `journals/${id}/${key}.html`],
    ["뒤에 덧붙임", `journals/${id}/${key}.webp/extra`],
    ["접두사만", `journals/${id}/`],
  ])("%s 는 거절한다", (_label, path) => {
    expect(isJournalPhotoPath(id, path, "full")).toBe(false);
  });
});
