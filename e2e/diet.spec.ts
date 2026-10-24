import { expect, test } from "@playwright/test";

import { connectPair, newPage, signup, uniqueEmail } from "./helpers";

test.describe("식단", () => {
  test("끼니를 남기고 보고 지울 수 있다", async ({ browser }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "식단회원", uniqueEmail("diet"));

    await page.goto("/diet");
    await page.getByRole("link", { name: /식단 남기기|남기기/ }).first().click();
    await page.waitForURL(/\/diet\/new/);

    // 사진도 글도 없으면 남기지 못한다.
    await page.getByRole("button", { name: "남기기" }).click();
    await expect(
      page.getByText("사진을 올리거나 무엇을 먹었는지 적어주세요."),
    ).toBeVisible();

    await page.getByText("점심", { exact: true }).click();
    await page.fill("#foodName", "현미밥, 닭가슴살");
    await page.fill("#memo", "운동 전에 먹었어요");
    await page.getByRole("button", { name: "남기기" }).click();

    // 남긴 식단의 상세 화면으로 간다.
    await page.waitForURL(/\/diet\/[0-9a-f-]{36}$/);
    await expect(page.getByText("현미밥, 닭가슴살")).toBeVisible();
    await expect(page.getByText("운동 전에 먹었어요")).toBeVisible();
    await expect(page.getByText("아직 피드백이 없어요")).toBeVisible();

    // 목록에도 보인다.
    await page.goto("/diet");
    await expect(page.getByText("현미밥, 닭가슴살")).toBeVisible();

    // 지우면 목록에서 사라진다.
    await page.getByRole("link", { name: /현미밥, 닭가슴살/ }).click();
    await page.getByRole("button", { name: "삭제" }).click();
    await page.waitForURL(/\/diet(\?|$)/);
    await expect(page.getByText("현미밥, 닭가슴살")).toHaveCount(0);

    await member.context.close();
  });

  test("트레이너가 식단을 보고 피드백을 남기며, 공유를 끄면 가려진다", async ({
    browser,
  }) => {
    const { trainer, member, memberUrl } = await connectPair(browser);

    await member.page.goto("/diet/new");
    await member.page.fill("#foodName", "연어 샐러드");
    await member.page.getByRole("button", { name: "남기기" }).click();
    await member.page.waitForURL(/\/diet\/[0-9a-f-]{36}$/);
    const dietUrl = member.page.url();

    // 식단 공유는 기본으로 켜져 있어 연결된 트레이너에게 바로 보인다.
    await trainer.page.goto(`${memberUrl}/diet`);
    await expect(trainer.page.getByText("연어 샐러드")).toBeVisible();

    // 트레이너가 피드백을 남긴다. 빈 피드백은 거절된다.
    await trainer.page.getByRole("link", { name: /연어 샐러드/ }).click();
    await trainer.page.waitForURL(/\/diet\/[0-9a-f-]{36}$/);
    await trainer.page.getByRole("button", { name: "피드백 남기기" }).click();
    await expect(
      trainer.page.getByText("피드백 내용을 적어주세요."),
    ).toBeVisible();

    await trainer.page.fill("#content", "단백질 좋아요. 채소를 더 챙겨요.");
    await trainer.page.getByRole("button", { name: "피드백 남기기" }).click();
    await expect(
      trainer.page.getByText("단백질 좋아요. 채소를 더 챙겨요."),
    ).toBeVisible();

    // 회원에게 알림이 오고 상세에서 피드백이 보인다.
    await member.page.goto("/notifications");
    await expect(
      member.page.getByText("식단 피드백이 도착했어요"),
    ).toBeVisible();

    await member.page.goto(dietUrl);
    await expect(
      member.page.getByText("단백질 좋아요. 채소를 더 챙겨요."),
    ).toBeVisible();

    // 회원이 공유를 끄면 트레이너에게서 사라진다.
    await member.page.goto("/profile/sharing");
    await member.page.locator("input[name=shareDiet]").uncheck();
    await member.page.getByRole("button", { name: "저장" }).click();
    await expect(member.page.getByText("저장했어요.")).toBeVisible();

    await trainer.page.goto(`${memberUrl}/diet`);
    await expect(
      trainer.page.getByText("회원이 식단을 공유하지 않았어요"),
    ).toBeVisible();
    await expect(trainer.page.getByText("연어 샐러드")).toHaveCount(0);

    await trainer.context.close();
    await member.context.close();
  });
});
