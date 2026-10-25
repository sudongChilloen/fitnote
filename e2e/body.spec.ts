import { expect, test, type Page } from "@playwright/test";

import { kstDateKey, newPage, signup, uniqueEmail } from "./helpers";

async function saveBody(
  page: Page,
  values: {
    date?: string;
    weight?: string;
    fat?: string;
    muscle?: string;
    memo?: string;
  },
) {
  await page.goto("/body/new");
  if (values.date) await page.fill("input[name=dateKey]", values.date);
  if (values.weight) await page.fill("input[name=weightKg]", values.weight);
  if (values.fat) await page.fill("input[name=bodyFatPercent]", values.fat);
  if (values.muscle) {
    await page.fill("input[name=skeletalMuscleKg]", values.muscle);
  }
  if (values.memo) await page.fill("textarea[name=memo]", values.memo);
  await page.getByRole("button", { name: "저장하기" }).click();
}

test.describe("체성분", () => {
  test("기록이 없으면 안내가 나오고, 채우지 않거나 범위를 벗어나면 저장되지 않는다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "체성분회원", uniqueEmail("body"));

    await page.goto("/body");
    await expect(page.getByText("아직 잰 기록이 없어요")).toBeVisible();

    await saveBody(page, {});
    await expect(page.getByText("적어도 하나는 채워주세요.")).toBeVisible();

    await saveBody(page, { weight: "5" });
    await expect(
      page.getByText("넣은 값을 확인해주세요. 날짜와 숫자 범위를 봐주세요."),
    ).toBeVisible();

    await page.goto("/body");
    await expect(page.getByText("아직 잰 기록이 없어요")).toBeVisible();

    await member.context.close();
  });

  test("기록하면 최근 값과 지난번과의 차이가 나오고, 같은 날 다시 적으면 덮어쓴다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "추이회원", uniqueEmail("body"));

    await saveBody(page, { date: kstDateKey(1), weight: "72", fat: "24" });
    await page.waitForURL("**/body");
    await saveBody(page, {
      weight: "70.5",
      fat: "23",
      muscle: "30",
      memo: "아침 공복",
    });
    await page.waitForURL("**/body");

    const weight = page.locator("article", { hasText: "체중" }).first();
    await expect(weight).toContainText("70.5kg");
    await expect(weight).toContainText("지난번보다 -1.5kg");
    await expect(page.locator("article", { hasText: "체지방률" })).toContainText(
      "23%",
    );
    await expect(page.locator("article", { hasText: "골격근량" })).toContainText(
      "30kg",
    );
    await expect(page.getByText("아침 공복")).toBeVisible();

    // 같은 날 다시 적으면 기록이 늘지 않고 값만 바뀐다.
    await saveBody(page, { weight: "70" });
    await page.waitForURL("**/body");
    await expect(
      page.locator("article", { hasText: "체중" }).first(),
    ).toContainText("70kg");
    await expect(page.getByRole("button", { name: "기록 지우기" })).toHaveCount(2);

    await member.context.close();
  });

  test("기록을 지우면 목록에서 사라진다", async ({ browser }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "삭제회원", uniqueEmail("body"));

    await saveBody(page, { weight: "80" });
    await page.waitForURL("**/body");
    await expect(page.getByRole("button", { name: "기록 지우기" })).toHaveCount(1);

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "기록 지우기" }).click();

    await expect(page.getByText("아직 잰 기록이 없어요")).toBeVisible();

    await member.context.close();
  });

  test("목표를 세우면 남은 만큼이 보이고, 그만둘 수 있다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "목표회원", uniqueEmail("body"));

    await saveBody(page, { weight: "75" });
    await page.waitForURL("**/body");

    // 범위를 벗어난 목표는 거절된다.
    await page.goto("/body/goal");
    await page.fill("input[name=targetValue]", "5");
    await page.getByRole("button", { name: "목표 세우기" }).click();
    await expect(
      page.getByText("넣은 값을 확인해주세요. 날짜와 숫자 범위를 봐주세요."),
    ).toBeVisible();

    await page.fill("input[name=targetValue]", "70");
    await page.getByRole("button", { name: "목표 세우기" }).click();
    await page.waitForURL("**/body");

    const goal = page.locator("li", { hasText: "체중 70kg" });
    await expect(goal).toContainText("5kg 남음");
    await expect(goal).toContainText("지금 75kg");

    // 새 값을 재면 목표가 따라온다.
    await saveBody(page, { weight: "72" });
    await page.waitForURL("**/body");
    await expect(page.locator("li", { hasText: "체중 70kg" })).toContainText(
      "2kg 남음",
    );

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "목표 그만두기" }).click();
    await expect(page.getByText("목표를 정해두면 지금 값이")).toBeVisible();

    await member.context.close();
  });
});
