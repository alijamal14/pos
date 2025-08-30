import { test, expect } from '@playwright/test';

test('P2P Items app loads and shows UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(/P2P Items/);
  await expect(page.locator('button', { hasText: 'Add' })).toBeVisible();
});
