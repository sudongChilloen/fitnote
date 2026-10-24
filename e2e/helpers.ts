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
