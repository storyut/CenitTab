import { test, expect } from '@playwright/test';

test('newtab page loads with .top-bar visible', async ({ page }) => {
  await page.goto('http://localhost:3999/newtab.html');
  await expect(page.locator('.top-bar')).toBeVisible();
  await expect(page).toHaveTitle('New Tab');
});
