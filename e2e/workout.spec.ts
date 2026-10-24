import { expect, test, type Page } from "@playwright/test";

import { newPage, signup, uniqueEmail } from "./helpers";

async function startWorkout(page: Page) {
  await page.goto("/home");
  await page.getByRole("button", { name: /운동 시작하기/ }).click();
  await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
}

async function addExercise(page: Page, name: string) {
  await page.getByRole("button", { name: "운동 추가" }).first().click();
  await page.getByLabel("운동 검색").fill(name);
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  await page.getByRole("button", { name: "1개 추가" }).click();
  await expect(page.getByRole("button", { name: "세트 추가" })).toBeVisible();
}

test.describe("운동 기록", () => {
  test("운동을 담고 세트를 적어 마치면 요약에 볼륨이 나온다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "운동회원", uniqueEmail("wk"));

    await startWorkout(page);
    await addExercise(page, "백스쿼트");

    await page.getByRole("button", { name: "세트 추가" }).click();
    await page.getByLabel("1세트 중량(kg)").fill("60");
    await page.getByLabel("1세트 횟수").fill("10");
    await page.getByLabel("1세트 횟수").blur();
    // 값을 적고 칸을 벗어나면 세트가 저장되고 완료로 센다.
    await expect(page.getByText("600kg").first()).toBeVisible();

    await page.getByRole("button", { name: "세트 추가" }).click();
    await page.getByLabel("2세트 중량(kg)").fill("70");
    await page.getByLabel("2세트 횟수").fill("5");
    await page.getByLabel("2세트 횟수").blur();

    // 60x10 + 70x5 = 950kg. 서버가 계산한 값이 화면에 나온다.
    await expect(page.getByText("950kg").first()).toBeVisible();

    await page.getByRole("button", { name: "운동 종료" }).click();
    await page.waitForURL(/\/summary$/);
    await expect(page.getByRole("heading", { name: "운동을 마쳤어요" })).toBeVisible();
    await expect(page.getByText("950").first()).toBeVisible();

    // 끝난 운동은 진행 중 배너에 남지 않는다.
    await page.goto("/home");
    await expect(page.getByText("이어서 하기")).toHaveCount(0);

    await member.context.close();
  });

  test("진행 중인 운동은 홈에서 이어서 할 수 있다", async ({ browser }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "이어운동", uniqueEmail("wk"));

    await startWorkout(page);
    await addExercise(page, "덤벨컬");
    const url = page.url();

    await page.goto("/home");
    await page.getByText("이어서 하기").click();
    await page.waitForURL(url);
    await expect(page.getByText("덤벨컬")).toBeVisible();

    await member.context.close();
  });

  test("지난 운동을 몰아서 기록하고 운동 시간을 적을 수 있다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "지난운동", uniqueEmail("wk"));

    await page.goto("/calendar");
    await page.getByRole("button", { name: /지난 운동 기록|기록/ }).first().click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
    await addExercise(page, "백스쿼트");

    await page.getByRole("button", { name: "세트 추가" }).click();
    await page.getByLabel("1세트 중량(kg)").fill("50");
    await page.getByLabel("1세트 횟수").fill("8");
    await page.getByLabel("1세트 횟수").blur();

    // 범위를 벗어난 시간은 저장되지 않고 안내가 뜬다.
    await page.getByLabel("운동 시간(분)").fill("2000");
    await page.getByRole("button", { name: "기록 저장" }).click();
    await expect(page.getByText(/1분에서 1440분 사이/)).toBeVisible();

    await page.getByLabel("운동 시간(분)").fill("45");
    await page.getByRole("button", { name: "기록 저장" }).click();
    await page.waitForURL(/\/summary$/);
    await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();
    await expect(page.locator("dt:has-text('시간') + dd")).toHaveText("45분");

    await member.context.close();
  });

  test("운동 시간을 비워 두면 시간 없이 저장된다", async ({ browser }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "시간없음", uniqueEmail("wk"));

    await page.goto("/calendar");
    await page.getByRole("button", { name: /지난 운동 기록|기록/ }).first().click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
    await addExercise(page, "덤벨컬");

    await page.getByRole("button", { name: "기록 저장" }).click();
    await page.waitForURL(/\/summary$/);
    await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();
    await expect(page.locator("dt:has-text('시간') + dd")).toHaveText("—");

    await member.context.close();
  });
});
