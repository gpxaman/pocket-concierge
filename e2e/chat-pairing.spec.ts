import { test, expect, Page } from "@playwright/test";

// Two isolated browser contexts stand in for two real devices talking
// through the shared relay server (server/chat-relay.mjs) — each gets its
// own localStorage/identity, exactly like two different phones. Verifies
// the full pairing + E2E messaging path: claim a username, add each other,
// and exchange a message that round-trips through real encryption.
async function claimUsername(page: Page, username: string) {
  await page.goto("/profile/account");
  await page.getByPlaceholder("e.g. aman_k").fill(username);
  await page.getByRole("button", { name: /save/i }).click();
  await expect(page.getByText(`@${username}`, { exact: true })).toBeVisible({ timeout: 15_000 });
}

test("two users claim usernames, add each other, and exchange an end-to-end encrypted message", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const suffix = Date.now().toString(36);
  const userA = `e2e_a_${suffix}`;
  const userB = `e2e_b_${suffix}`;

  await claimUsername(pageA, userA);
  await claimUsername(pageB, userB);

  // A adds B by username.
  await pageA.goto("/chat/new");
  await pageA.getByPlaceholder(/search or add by username/i).fill(userB);
  await pageA.getByRole("button", { name: "Add" }).click();
  await expect(pageA).toHaveURL(/\/chat\/.+/);

  // B adds A back (real E2E needs both sides to hold the other's public key).
  await pageB.goto("/chat/new");
  await pageB.getByPlaceholder(/search or add by username/i).fill(userA);
  await pageB.getByRole("button", { name: "Add" }).click();
  await expect(pageB).toHaveURL(/\/chat\/.+/);

  // A sends a message; B should see it arrive, decrypted, on the chat list.
  const messageText = `hello from ${userA} at ${suffix}`;
  await pageA.getByPlaceholder("Message…").fill(messageText);
  await pageA.getByPlaceholder("Message…").press("Enter");
  await expect(pageA.getByText(messageText)).toBeVisible();

  await pageB.goto("/chat");
  await expect(pageB.getByText(messageText)).toBeVisible({ timeout: 15_000 });

  await contextA.close();
  await contextB.close();
});
