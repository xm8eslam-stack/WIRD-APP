import { expect, test } from '@playwright/test';

test.describe('WIRD navigation and memorization tafsir UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  });

  test('mobile navigation keeps core destinations visible and groups secondary pages in More', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const bottomNav = page.getByRole('navigation', { name: 'التنقل السريع' });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'الرئيسية' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'القرآن' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'الحفظ' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'المراجعة' })).toBeVisible();

    await bottomNav.getByRole('button', { name: 'المزيد من الأقسام' }).click();
    const drawerNav = page.getByRole('navigation', { name: 'القائمة الرئيسية' });
    await expect(drawerNav).toBeVisible();
    await expect(drawerNav.getByText('الحفظ والتثبيت')).toBeVisible();
    await expect(drawerNav.getByText('المتابعة والمساندة')).toBeVisible();
    await expect(drawerNav.getByRole('button', { name: 'اختبارات الحفظ' })).toBeVisible();
    await expect(drawerNav.getByRole('button', { name: 'الإعدادات' })).toBeVisible();
  });

  test('memorization tafsir is collapsed by default and can be toggled without leaving the session', async ({ page }) => {
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');

    const tafsirToggle = page.locator('section[aria-labelledby="session-tafsir-title"] > button');
    await expect(tafsirToggle).toBeVisible();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('مصدر التفسير في الجلسة')).toHaveCount(0);

    await tafsirToggle.click();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('مصدر التفسير في الجلسة')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird_session_tafsir_expanded_v1'))).toBe('1');

    await tafsirToggle.click();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird_session_tafsir_expanded_v1'))).toBe('0');
    await expect(page.getByText(/الآية 1 من 3/)).toBeVisible();
  });
});
