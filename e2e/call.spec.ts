import { test, expect, Page } from "@playwright/test";

// WebRTC audio/video call between two real (fake-media) browser contexts,
// signaled through the same relay used for messaging. Chromium's
// --use-fake-device-for-media-stream / --use-fake-ui-for-media-stream flags
// (set in playwright.config.ts) supply a synthetic camera/mic so this runs
// headless without a real device or a permission prompt.
async function claimUsername(page: Page, username: string) {
  await page.goto("/profile/account");
  await page.getByPlaceholder("e.g. aman_k").fill(username);
  await page.getByRole("button", { name: /save/i }).click();
  await expect(page.getByText(`@${username}`, { exact: true })).toBeVisible({ timeout: 15_000 });
}

test("one user calls another and both reach an active call state", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const suffix = Date.now().toString(36);
  const userA = `e2e_call_a_${suffix}`;
  const userB = `e2e_call_b_${suffix}`;

  await claimUsername(pageA, userA);
  await claimUsername(pageB, userB);

  await pageA.goto("/chat/new");
  await pageA.getByPlaceholder(/search or add by username/i).fill(userB);
  await pageA.getByRole("button", { name: "Add" }).click();
  await expect(pageA).toHaveURL(/\/chat\/.+/);

  await pageB.goto("/chat/new");
  await pageB.getByPlaceholder(/search or add by username/i).fill(userA);
  await pageB.getByRole("button", { name: "Add" }).click();
  await expect(pageB).toHaveURL(/\/chat\/.+/);

  // Both sides need to be marked online by the relay before a call can start.
  await expect(pageA.getByText("online")).toBeVisible({ timeout: 15_000 });

  await pageA.getByTitle("Voice call").click();
  await pageB.getByTitle("Accept").click({ timeout: 15_000 });

  await expect(pageA.getByTitle("End call")).toBeVisible({ timeout: 15_000 });
  await expect(pageB.getByTitle("End call")).toBeVisible({ timeout: 15_000 });

  await pageA.getByTitle("End call").click();
  await expect(pageB.getByTitle("End call")).not.toBeVisible({ timeout: 10_000 });

  await contextA.close();
  await contextB.close();
});
