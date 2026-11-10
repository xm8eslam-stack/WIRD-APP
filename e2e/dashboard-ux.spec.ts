import { expect, test } from '@playwright/test';

test.describe('WIRD dashboard accessibility and responsive UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await expect(page.getByRole('heading', { name: /السلام عليكم ورحمة الله/ })).toBeVisible();
  });

  test('weekly activity is exposed as a readable list and quick actions have touch targets', async ({ page }) => {
    const activity = page.getByRole('list', { name: 'النشاط الأسبوعي' });
    await expect(activity).toBeVisible();
    const quickAction = page.getByRole('button', { name: /اختبر حفظك الآن/ });
    await expect(quickAction).toBeVisible();
    await expect(quickAction).toHaveCSS('min-height', '64px');
    await expect(activity.getByRole('listitem')).toHaveCount(7);
    await expect(page.getByRole('progressbar')).toHaveCount(9);
    await expect(page.getByRole('progressbar', { name: 'نسبة الآيات المحفوظة' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'نسبة الصفحات المحفوظة بالكامل' })).toBeVisible();
    await quickAction.focus();
    await expect(quickAction).toBeFocused();
  });

  test('dashboard remains usable on a narrow phone without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'إجراءات سريعة' })).toBeVisible();
    await expect(page.getByRole('button', { name: /تصفح المصحف والمكتبة/ })).toHaveCSS('min-height', '64px');
    await expect(page.getByRole('button', { name: /بدء جلسة|اختر نطاق الخطة/ })).toHaveCSS('min-height', '48px');
    await expect(page.getByRole('button', { name: 'سورة أخرى' })).toHaveCSS('min-height', '44px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
