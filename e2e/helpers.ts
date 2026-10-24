import { randomUUID } from "node:crypto";

import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "Passw0rd123";

/**
 * 가입 시도는 같은 IP 에서 1시간에 10번까지라, 테스트가 쌓이면 그 한도에 걸린다.
 * 앱은 x-forwarded-for 로 IP 를 보므로 창마다 다른 값을 실어 보낸다.
 */
export const randomIpHeaders = () => ({
  "x-forwarded-for": Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 254 + 1),
  ).join("."),
});

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${randomUUID().slice(0, 8)}@e2e.test`;

/** 가입 화면에서 역할을 고르고 가입한다. 가입 뒤 첫 화면까지 기다린다. */
export async function signup(
  page: Page,
  role: "MEMBER" | "TRAINER",
  name: string,
  email: string,
) {
  await page.goto("/signup");
  await page.locator(`input[name=role][value=${role}]`).check({ force: true });
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL(role === "TRAINER" ? "**/trainer" : "**/home");
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** 쿠키가 섞이지 않는 새 브라우저 창. */
export async function newPage(browser: Browser) {
  const context = await browser.newContext({
    extraHTTPHeaders: randomIpHeaders(),
  });
  return { context, page: await context.newPage() };
}

export async function expectPath(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(path);
}

/** 트레이너와 회원을 가입시키고 연결 코드로 이어 준다. 회원 상세 주소를 돌려준다. */
export async function connectPair(browser: Browser) {
  const trainer = await newPage(browser);
  const member = await newPage(browser);

  await signup(trainer.page, "TRAINER", "정트레이너", uniqueEmail("tr"));
  await signup(member.page, "MEMBER", "최회원", uniqueEmail("me"));

  await trainer.page.goto("/trainer/profile");
  await trainer.page
    .getByRole("button", { name: "회원 연결 코드 만들기" })
    .click();
  const code = (
    await trainer.page.locator("p.font-mono").first().innerText()
  ).trim();

  await member.page.goto("/profile");
  await member.page.getByLabel("초대 코드").fill(code);
  await member.page.getByRole("button", { name: "연결" }).click();
  await expect(
    member.page.getByText("정트레이너 트레이너와 연결됐어요."),
  ).toBeVisible();

  await trainer.page.goto("/trainer/members");
  await trainer.page.getByRole("link", { name: /최회원/ }).first().click();
  await trainer.page.waitForURL(/\/trainer\/members\/[^/]+$/);

  return { trainer, member, memberUrl: trainer.page.url() };
}
