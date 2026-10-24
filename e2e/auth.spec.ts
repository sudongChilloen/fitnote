import { expect, test } from "@playwright/test";

import {
  PASSWORD,
  expectPath,
  login,
  newPage,
  randomIpHeaders,
  signup,
  uniqueEmail,
} from "./helpers";

test.describe("가입과 로그인", () => {
  test.beforeEach(async ({ context }) => {
    await context.setExtraHTTPHeaders(randomIpHeaders());
  });

  test("로그인 화면에서 회원가입으로 갈 수 있다", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "회원가입" }).click();

    await expectPath(page, "/signup");
    await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
  });

  test("가입 입력이 잘못되면 이유를 보여주고 가입하지 않는다", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.fill("#name", "김");
    await page.fill("#email", "ok@e2e.test");
    await page.fill("#password", "short");
    await page.getByRole("button", { name: "가입하기" }).click();

    await expect(page.getByText("이름은 2자 이상")).toBeVisible();
    await expect(page.getByText("비밀번호는 8자 이상")).toBeVisible();
    await expectPath(page, "/signup");
  });

  test("회원으로 가입하면 회원 화면으로, 트레이너로 가입하면 트레이너 화면으로 간다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    await signup(member.page, "MEMBER", "회원이", uniqueEmail("member"));
    await expectPath(member.page, "/home");

    const trainer = await newPage(browser);
    await signup(trainer.page, "TRAINER", "트레이너", uniqueEmail("trainer"));
    await expectPath(trainer.page, "/trainer");

    await member.context.close();
    await trainer.context.close();
  });

  test("한 계정은 다른 역할의 화면에 들어가지 못한다", async ({ browser }) => {
    const member = await newPage(browser);
    await signup(member.page, "MEMBER", "회원이", uniqueEmail("member"));
    await member.page.goto("/trainer");
    await expectPath(member.page, "/home");

    const trainer = await newPage(browser);
    await signup(trainer.page, "TRAINER", "트레이너", uniqueEmail("trainer"));
    await trainer.page.goto("/home");
    await expectPath(trainer.page, "/trainer");

    await member.context.close();
    await trainer.context.close();
  });

  test("이미 가입한 이메일로는 다시 가입할 수 없다", async ({ browser }) => {
    const email = uniqueEmail("dup");
    const first = await newPage(browser);
    await signup(first.page, "MEMBER", "첫번째", email);

    const second = await newPage(browser);
    await second.page.goto("/signup");
    await second.page.fill("#name", "두번째");
    await second.page.fill("#email", email);
    await second.page.fill("#password", PASSWORD);
    await second.page.getByRole("button", { name: "가입하기" }).click();

    await expect(second.page.getByText("이미 가입된 이메일이에요.")).toBeVisible();

    await first.context.close();
    await second.context.close();
  });

  test("로그아웃한 뒤 다시 로그인하면 역할에 맞는 화면으로 간다", async ({
    page,
  }) => {
    const email = uniqueEmail("trainer");
    await signup(page, "TRAINER", "트레이너", email);

    await page.goto("/trainer/profile");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expectPath(page, "/login");

    // 로그아웃 상태에서는 보호된 화면이 로그인으로 돌려보낸다.
    await page.goto("/trainer");
    await expectPath(page, "/login");

    await login(page, email);
    await expectPath(page, "/trainer");
  });

  test("비밀번호가 틀리면 로그인되지 않는다", async ({ page }) => {
    const email = uniqueEmail("member");
    await signup(page, "MEMBER", "회원이", email);
    await page.context().clearCookies();

    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", "Wrong-pass-1");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(
      page.getByText("이메일 또는 비밀번호가 올바르지 않습니다."),
    ).toBeVisible();
    await expectPath(page, "/login");
  });
});
