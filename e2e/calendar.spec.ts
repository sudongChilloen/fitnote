import { expect, test, type Page } from "@playwright/test";

import { kstDateKey, newPage, signup, uniqueEmail } from "./helpers";

async function addBackSquatSession(page: Page) {
  await page.getByRole("button", { name: "운동 추가" }).first().click();
  await page.getByLabel("운동 검색").fill("백스쿼트");
  await page.getByRole("button", { name: /^백스쿼트/ }).first().click();
  await page.getByRole("button", { name: "1개 추가" }).click();
  await page.getByRole("button", { name: "세트 추가" }).click();
  await page.getByLabel("1세트 중량(kg)").fill("60");
  await page.getByLabel("1세트 횟수").fill("10");
  await page.getByLabel("1세트 횟수").blur();
  await expect(page.getByText("600kg").first()).toBeVisible();
}

test.describe("캘린더", () => {
  test("기록이 없는 날은 빈 안내가 나오고, 다른 날과 달을 오갈 수 있다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "캘린더회원", uniqueEmail("cal"));

    await page.goto("/calendar");
    await expect(page.getByText("이 날은 기록이 없어요.")).toBeVisible();
    await expect(page.getByText("이 날 남긴 식단이 없어요.")).toBeVisible();

    // 선택한 날짜가 주소에 실리고 화면에 표시된다.
    const target = kstDateKey(3);
    await page.goto(`/calendar?date=${target}`);
    await expect(page.locator("a[aria-current=date]")).toHaveAttribute(
      "href",
      new RegExp(`date=${target}$`),
    );

    // 이전 달로 가도 선택한 날짜는 그대로다.
    const [year, month] = target.split("-").map(Number);
    await page.getByRole("link", { name: "이전 달" }).click();
    const prev = month === 1 ? [year - 1, 12] : [year, month - 1];
    await expect(page.getByText(`${prev[0]}년 ${prev[1]}월`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`date=${target}`));

    await member.context.close();
  });

  test("그날 한 운동과 먹은 식단이 함께 보인다", async ({ browser }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "하루회원", uniqueEmail("cal"));

    // 오늘 식단 하나, 오늘 운동 하나.
    await page.goto("/diet/new");
    await page.fill("#foodName", "고구마와 계란");
    await page.getByRole("button", { name: "남기기" }).click();
    await page.waitForURL(/\/diet\/[0-9a-f-]{36}$/);

    await page.goto("/home");
    await page.getByRole("button", { name: /운동 시작하기/ }).click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
    await addBackSquatSession(page);
    await page.getByRole("button", { name: "운동 종료" }).click();
    await page.waitForURL(/\/summary$/);

    await page.goto("/calendar");
    const session = page.getByRole("link", { name: /백스쿼트/ });
    await expect(session).toContainText("1세트");
    await expect(session).toContainText("600kg");
    await expect(page.getByText("고구마와 계란")).toBeVisible();
    await expect(page.getByText("이 날은 기록이 없어요.")).toHaveCount(0);

    // 운동을 눌러 들어가면 그 기록이 열린다.
    await session.click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
    await expect(page.getByText("백스쿼트")).toBeVisible();

    // 기록이 없는 다른 날은 비어 있다.
    await page.goto(`/calendar?date=${kstDateKey(5)}`);
    await expect(page.getByText("이 날은 기록이 없어요.")).toBeVisible();
    await expect(page.getByText("고구마와 계란")).toHaveCount(0);

    await member.context.close();
  });

  test("지난 날짜를 골라 운동을 기록하면 그 날에 나타난다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "지난날회원", uniqueEmail("cal"));

    const day = kstDateKey(2);
    await page.goto(`/calendar?date=${day}`);
    await page.getByRole("button", { name: "이 날짜 기록하기" }).click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);

    await addBackSquatSession(page);
    await page.getByLabel("운동 시간(분)").fill("45");
    await page.getByRole("button", { name: "기록 저장" }).click();
    await page.waitForURL(/\/summary$/);

    await page.goto(`/calendar?date=${day}`);
    const session = page.getByRole("link", { name: /백스쿼트/ });
    await expect(session).toContainText("600kg");
    await expect(session).toContainText("45분");

    // 이미 기록이 있어도 같은 날에 더 추가할 수 있다.
    await expect(
      page.getByRole("button", { name: "이 날짜에 기록 추가" }),
    ).toBeVisible();

    // 오늘에는 보이지 않는다.
    await page.goto("/calendar");
    await expect(page.getByText("이 날은 기록이 없어요.")).toBeVisible();

    await member.context.close();
  });
});
