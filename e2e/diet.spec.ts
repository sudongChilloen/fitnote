import { expect, test } from "@playwright/test";

import {
  connectPair,
  newPage,
  signup,
  solidPng,
  storedObjects,
  uniqueEmail,
} from "./helpers";

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

test.describe("식단 사진", () => {
  const photo = () => ({
    name: "meal.png",
    mimeType: "image/png",
    buffer: solidPng(),
  });

  test("사진을 올려 남기면 상세에서 보이고, 지우면 저장소에서도 사라진다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "사진회원", uniqueEmail("photo"));
    const before = (await storedObjects()).length;

    await page.goto("/diet/new");
    await page.locator("input[type=file]").setInputFiles(photo());
    await expect(page.getByAltText("고른 사진")).toBeVisible();

    // 원본과 미리보기 두 장이 저장소에 올라갔다.
    await expect.poll(async () => (await storedObjects()).length).toBe(before + 2);

    await page.fill("#foodName", "비빔밥");
    await page.getByRole("button", { name: "남기기" }).click();
    await page.waitForURL(/\/diet\/[0-9a-f-]{36}$/);

    // 서명 주소로 불러온 사진이 실제로 그려졌다.
    const image = page.getByAltText("비빔밥");
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // 식단을 지우면 사진 두 장도 저장소에서 지워진다.
    await page.getByRole("button", { name: "삭제" }).click();
    await page.waitForURL(/\/diet(\?|$)/);
    await expect.poll(async () => (await storedObjects()).length).toBe(before);

    await member.context.close();
  });

  test("올린 사진을 남기기 전에 빼면 저장소에서도 지운다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "사진빼기", uniqueEmail("photo"));
    const before = (await storedObjects()).length;

    await page.goto("/diet/new");
    await page.locator("input[type=file]").setInputFiles(photo());
    await expect(page.getByAltText("고른 사진")).toBeVisible();
    await expect.poll(async () => (await storedObjects()).length).toBe(before + 2);

    await page.getByRole("button", { name: "사진 빼기" }).click();
    await expect(page.getByAltText("고른 사진")).toHaveCount(0);
    await expect.poll(async () => (await storedObjects()).length).toBe(before);

    // 사진 없이 글 없이 남기려 하면 거절된다. 빠진 사진이 폼에 남아 있지 않다.
    await page.getByRole("button", { name: "남기기" }).click();
    await expect(
      page.getByText("사진을 올리거나 무엇을 먹었는지 적어주세요."),
    ).toBeVisible();

    await member.context.close();
  });

  test("트레이너는 공유된 식단 사진을 보고, 사진 공유를 끄면 글만 보인다", async ({
    browser,
  }) => {
    const { trainer, member, memberUrl } = await connectPair(browser);

    await member.page.goto("/diet/new");
    await member.page.locator("input[type=file]").setInputFiles(photo());
    await expect(member.page.getByAltText("고른 사진")).toBeVisible();
    await member.page.fill("#foodName", "닭가슴살 도시락");
    await member.page.getByRole("button", { name: "남기기" }).click();
    await member.page.waitForURL(/\/diet\/[0-9a-f-]{36}$/);

    // 기본 설정에서는 사진도 함께 보인다.
    await trainer.page.goto(`${memberUrl}/diet`);
    const thumb = trainer.page.locator("main img").first();
    await expect(thumb).toBeVisible();
    await expect
      .poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // 회원이 사진 공유만 끈다.
    await member.page.goto("/profile/sharing");
    await member.page.locator("input[name=shareDietPhoto]").uncheck();
    await member.page.getByRole("button", { name: "저장" }).click();
    await expect(member.page.getByText("저장했어요.")).toBeVisible();

    await trainer.page.goto(`${memberUrl}/diet`);
    await expect(trainer.page.getByText("닭가슴살 도시락")).toBeVisible();
    await expect(trainer.page.locator("main img")).toHaveCount(0);
    await expect(
      trainer.page.getByText("회원이 사진은 공유하지 않고 있어요"),
    ).toBeVisible();

    await trainer.context.close();
    await member.context.close();
  });
});
