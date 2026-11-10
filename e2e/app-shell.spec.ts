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

test('installed service worker serves the complete app shell after an offline reload', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();

  const workerReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  expect(workerReady).toBe(true);

  // A reload moves this already-open page under the newly activated worker's control.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cachedShell = await page.evaluate(async () => {
    const cache = await caches.open('wird-app-v3');
    const keys = await cache.keys();
    return keys.map(request => new URL(request.url).pathname);
  });
  expect(cachedShell.some(path => path.endsWith('.js'))).toBe(true);
  expect(cachedShell.some(path => path.endsWith('.css'))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();

  await context.setOffline(false);
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


test('tablet portrait keeps compact navigation and opens the full section drawer', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');

  const quickNav = page.getByRole('navigation', { name: 'التنقل السريع' });
  await expect(quickNav).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'القائمة الرئيسية' })).toBeHidden();

  await page.getByRole('button', { name: 'المزيد من الأقسام' }).click();
  await expect(page.getByRole('navigation', { name: 'القائمة الرئيسية' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'الإعدادات' })).toBeVisible();
  await expect(page.getByRole('button', { name: /معرض الهوية/ })).toHaveCount(0);
});

test('more navigation is marked active while a secondary section is open', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/#/progress');

  const moreButton = page.getByRole('button', { name: 'المزيد من الأقسام' });
  await expect(moreButton).toHaveAttribute('aria-current', 'page');
});


test('dashboard shows the daily session action once and no hard-coded monthly progress', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('الهدف الشهري: ختم جزء عمّ')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /ابدأ ورد اليوم|ابدأ مراجعة اليوم/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /بدء جلسة الحفظ التفاعلية|بدء جلسة المراجعة التفاعلية/ })).toBeVisible();
});
