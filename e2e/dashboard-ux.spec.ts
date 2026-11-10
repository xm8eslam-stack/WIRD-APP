import { expect, test } from '@playwright/test';

test.describe('WIRD dashboard responsive and accessible layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  });

  test('dashboard exposes named Quran progress and weekly activity to assistive technology', async ({ page }) => {
    await expect(page.getByRole('region', { name: /السلام عليكم/ })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'نسبة الآيات المحفوظة' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'نسبة الصفحات المحفوظة بالكامل' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'نشاط الحفظ والمراجعة خلال آخر سبعة أيام' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'نشاط الحفظ والمراجعة خلال آخر سبعة أيام' }).getByRole('listitem')).toHaveCount(7);
    await expect(page.getByRole('progressbar')).toHaveCount(9);
  });

  test('phone dashboard keeps its primary actions tappable without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: /بدء جلسة|اختر نطاق الخطة/ })).toHaveCSS('min-height', '48px');
    await expect(page.getByRole('button', { name: 'سورة أخرى' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: /اختبر حفظك الآن/ })).toHaveCSS('min-height', '64px');
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });
});
