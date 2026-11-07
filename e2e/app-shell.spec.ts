import { expect, test } from '@playwright/test';

test('production app shell renders without uncaught runtime errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  const root = page.locator('#root');
  await expect(root).toBeVisible();
  await expect(root).not.toBeEmpty();
  await expect(page.locator('body')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('production app shell survives a hard refresh', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  await page.reload();
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();
});

test('page does not introduce viewport-level horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth
  }));

  expect(
    dimensions.documentWidth,
    `document overflowed viewport: ${dimensions.documentWidth}px > ${dimensions.viewportWidth}px`
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
});
