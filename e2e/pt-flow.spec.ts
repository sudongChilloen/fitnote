import { expect, test, type Page } from "@playwright/test";

import { newPage, signup, uniqueEmail } from "./helpers";

/**
 * 트레이너와 회원이 만나는 한 바퀴.
 * 연결 코드 → 계약 → 수업 → 알림장 → 회원 알림, 그리고 가입 링크로 이어받기.
 */

test.describe("트레이너와 회원의 한 바퀴", () => {
  test("연결 코드로 이어지고 알림장이 회원에게 도착한다", async ({
    browser,
  }) => {
    const trainer = await newPage(browser);
    const member = await newPage(browser);

    await signup(trainer.page, "TRAINER", "박트레이너", uniqueEmail("tr"));
    await signup(member.page, "MEMBER", "김회원", uniqueEmail("me"));

    // 1. 트레이너가 연결 코드를 만든다.
    await trainer.page.goto("/trainer/profile");
    await trainer.page
      .getByRole("button", { name: "회원 연결 코드 만들기" })
      .click();
    const code = (
      await trainer.page.locator("p.font-mono").first().innerText()
    ).trim();
    expect(code).toMatch(/^TR[A-Z0-9]+$/);

    // 2. 회원이 코드를 넣는다. 틀린 코드는 거절된다.
    await member.page.goto("/profile");
    const codeInput = member.page.getByLabel("초대 코드");
    await codeInput.fill("TRZZZZZZZZ");
    await member.page.getByRole("button", { name: "연결" }).click();
    await expect(member.page.getByText("코드를 확인해주세요.")).toBeVisible();

    await codeInput.fill(code);
    await member.page.getByRole("button", { name: "연결" }).click();
    await expect(member.page.getByText("박트레이너 트레이너와 연결됐어요.")).toBeVisible();

    // 3. 트레이너 회원 목록에 보인다.
    await trainer.page.goto("/trainer/members");
    await trainer.page.getByRole("link", { name: /김회원/ }).first().click();
    await trainer.page.waitForURL(/\/trainer\/members\/[^/]+$/);
    const memberUrl = trainer.page.url();

    // 4. 계약을 등록하고 수업을 잡는다.
    await trainer.page.getByRole("link", { name: "계약 등록" }).first().click();
    await trainer.page.fill("input[name=title]", "PT 10회");
    await trainer.page.getByRole("button", { name: "계약 등록하기" }).click();
    await trainer.page.waitForURL(memberUrl);
    await trainer.page
      .getByRole("link", { name: /PT 10회/ })
      .first()
      .click();
    await trainer.page.waitForURL(/\/contracts\/[^/]+$/);

    await trainer.page.evaluate(() =>
      document.querySelectorAll("details").forEach((d) => (d.open = true)),
    );
    await trainer.page.locator("button:has-text('수업 잡기')").first().click();
    await expect(trainer.page.getByText("1회차 수업")).toBeVisible();

    // 5. 수업을 완료하면 횟수가 줄어든다.
    await trainer.page.locator("button:has-text('수업 완료')").first().click();
    await expect(trainer.page.getByText("총 10회 중 1회 완료")).toBeVisible();

    // 6. 수업 기록에서 알림장을 시작해 게시한다.
    await trainer.page.goto("/trainer/journals");
    await trainer.page.getByText("수업 기록", { exact: true }).last().click();
    await trainer.page.waitForURL(/\/trainer\/sessions\/[^/]+$/);
    await trainer.page.getByRole("button", { name: "알림장 쓰기" }).click();
    await trainer.page.waitForURL(/\/trainer\/journals\/[^/]+$/);

    await trainer.page.fill("input[name=title]", "첫 수업");
    await trainer.page.fill("textarea[name=content]", "오늘 수고하셨어요");
    await trainer.page.fill("textarea[name=workoutSummary]", "스쿼트 위주");
    await trainer.page.getByRole("button", { name: "게시하기" }).click();
    await expect(trainer.page.getByText("게시 완료")).toBeVisible();

    // 7. 회원에게 알림이 오고, 눌러서 알림장을 읽을 수 있다.
    await member.page.goto("/notifications");
    await expect(member.page.getByText("새 알림장이 도착했어요")).toBeVisible();
    await member.page.getByText("새 알림장이 도착했어요").click();
    await member.page.waitForURL(/\/journal\/[^/]+$/);
    await expect(member.page.getByText("오늘 수고하셨어요")).toBeVisible();
    await expect(member.page.getByText("스쿼트 위주")).toBeVisible();

    // 8. 트레이너는 회원에게 보이는 화면을 미리 볼 수 있다.
    await trainer.page.goBack();
    await trainer.page.getByRole("link", { name: "회원에게 보이는 화면" }).click();
    await trainer.page.waitForURL(/\/preview$/);
    await expect(trainer.page.getByText("오늘 수고하셨어요")).toBeVisible();

    // 9. 회원이 알림장에 댓글을 단다.
    await member.page.getByPlaceholder(/./).first().fill("감사합니다!");
    await member.page.getByRole("button", { name: "등록" }).click();
    await expect(member.page.getByText("감사합니다!")).toBeVisible();

    await trainer.context.close();
    await member.context.close();
  });

  test("트레이너가 만든 회원이 가입 링크로 기록을 이어받는다", async ({
    browser,
  }) => {
    const trainer = await newPage(browser);
    await signup(trainer.page, "TRAINER", "이트레이너", uniqueEmail("tr"));

    await createPendingMember(trainer.page, "이어받을회원");

    await trainer.page
      .getByRole("button", { name: "가입 링크 만들기" })
      .click();
    const link = (await trainer.page.locator("p.font-mono").first().innerText()).trim();
    expect(link).toMatch(/\/signup\?code=MB[A-Z0-9]+$/);

    // 새로고침해도 같은 링크가 남아 있다.
    await trainer.page.reload();
    await expect(trainer.page.locator("p.font-mono").first()).toHaveText(link);

    // 회원이 링크를 열면 자기 이름이 적힌 이어받기 화면이 나온다.
    const member = await newPage(browser);
    await member.page.goto(link);
    await expect(member.page.getByText("이어받을회원님, 반가워요")).toBeVisible();

    await member.page.fill("#email", uniqueEmail("claimed"));
    await member.page.fill("#password", "Passw0rd123");
    await member.page.getByRole("button", { name: "시작하기" }).click();
    await member.page.waitForURL("**/home");

    await member.page.goto("/profile");
    await expect(member.page.getByText("이어받을회원")).toBeVisible();
    await expect(member.page.getByText("이트레이너 트레이너")).toBeVisible();

    // 이어받은 뒤에는 같은 링크가 더 이상 열리지 않는다.
    const stranger = await newPage(browser);
    await stranger.page.goto(link);
    await expect(stranger.page.getByRole("heading", { name: "회원가입" })).toBeVisible();

    // 트레이너 화면에서는 가입 링크 칸이 사라진다.
    await trainer.page.reload();
    await expect(trainer.page.getByText("가입 링크", { exact: true })).toHaveCount(0);

    await trainer.context.close();
    await member.context.close();
    await stranger.context.close();
  });
});

async function createPendingMember(page: Page, name: string) {
  await page.goto("/trainer/members");
  await page.getByRole("button", { name: /회원 추가/ }).first().click();
  await page.fill("input[name=name]", name);
  await page.getByRole("button", { name: "회원 등록하기" }).click();
  await page.waitForURL(/\/trainer\/members\/[^/]+$/);
}
