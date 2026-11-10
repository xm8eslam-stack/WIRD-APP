import { expect, test } from '@playwright/test';

test.describe('WIRD memorization tests UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/tests');
    await expect(page.getByRole('heading', { name: 'اختبارات الحفظ والتقييم الذاتي المتقدمة' })).toBeVisible();
  });

  test('test modes expose selected state and comfortable touch targets', async ({ page }) => {
    const forwardMode = page.getByRole('button', { name: /أكمل الآية التالية/ });
    const mutashabihatMode = page.getByRole('button', { name: /المتشابهات اللفظية/ });

    await expect(forwardMode).toHaveAttribute('aria-pressed', 'true');
    await expect(forwardMode).toHaveCSS('min-height', '44px');
    await mutashabihatMode.click();
    await expect(mutashabihatMode).toHaveAttribute('aria-pressed', 'true');
    await expect(forwardMode).toHaveAttribute('aria-pressed', 'false');

    const progress = page.getByRole('progressbar', { name: 'تقدم الاختبار' });
    await expect(progress).toBeVisible({ timeout: 15000 });
    await expect(progress).toHaveAttribute('aria-valuemin', '0');
    await expect(progress).toHaveAttribute('aria-valuenow', '1');

    const options = page.getByRole('group', { name: 'خيارات الإجابة' });
    const firstOption = options.getByRole('button').first();
    await expect(firstOption).toHaveAttribute('aria-pressed', 'false');
    await expect(firstOption).toHaveCSS('min-height', '44px');
    await firstOption.click();
    await expect(firstOption).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /السؤال التالي/ })).toBeVisible();
  });

  test('test workspace fits a narrow phone viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('group', { name: 'نوع الاختبار' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: /المتشابهات اللفظية/ })).toHaveCSS('min-height', '44px');
  });
});
