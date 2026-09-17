import { test, expect } from "@playwright/test";

// Exercises the manual (non-AI) checkout path end to end: add an item from
// a restaurant menu, top up the wallet (it starts at ₹0 for a fresh
// session), pay from the wallet, and land on Activity with the order
// recorded. Deliberately not the AI-agent checkout path — that depends on
// a configured provider API key, which CI won't have; this path is fully
// deterministic and still covers the same cart -> priceCart -> wallet debit
// -> transaction pipeline the AI path shares.
test("adds an item to cart, tops up the wallet, and completes checkout", async ({ page }) => {
  await page.goto("/explore/food/rest-spicehouse");
  await expect(page.getByText("Spice House")).toBeVisible();

  await page.getByRole("button", { name: "ADD" }).first().click();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();

  // Wallet starts empty — top it up from the Wallet tab before checkout.
  await page.goto("/wallet");
  await page.getByRole("button", { name: /add money/i }).click();
  await page.getByRole("button", { name: "₹1,000" }).click();
  await page.getByRole("button", { name: /^Add ₹1,000$/ }).click();
  await expect(page.getByText("₹1,000").first()).toBeVisible();

  await page.goto("/cart");
  await page.getByRole("button", { name: /^Wallet ₹1,000$/ }).click();
  await page.getByRole("button", { name: /^Place order/ }).click();

  await expect(page).toHaveURL(/\/activity/);
  await expect(page.getByText("North Indian Thali")).toBeVisible();
});
