import { expect, test } from '@playwright/test';

test.describe('WIRD memorization session display controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/session?surah=67&start=1&end=10&mode=memorize');
    await expect(page.getByRole('region', { name: 'إعدادات عرض جلسة الحفظ' })).toBeVisible();
  });

  test('text size, interface scale, and density controls expose accessible values and touch targets', async ({ page }) => {
    const controls = page.getByRole('region', { name: 'إعدادات عرض جلسة الحفظ' });
    const uiScale = controls.getByRole('slider', { name: 'حجم واجهة جلسة الحفظ' });
    const fontSize = controls.getByRole('slider', { name: 'حجم خط الآيات' });
    await expect(uiScale).toHaveCSS('min-height', '44px');
    await expect(fontSize).toHaveCSS('min-height', '44px');

    await uiScale.focus();
    await page.keyboard.press('ArrowRight');
    await expect(controls.locator('output[for="session-ui-scale"]')).toContainText('%');
    await fontSize.focus();
    await page.keyboard.press('ArrowRight');
    await expect(controls.locator('output[for="session-ayah-font-size"]')).toContainText('px');

    const compact = controls.getByRole('button', { name: 'مضغوطة' });
    await compact.click();
    await expect(compact).toHaveAttribute('aria-pressed', 'true');
    await expect(compact).toHaveCSS('min-height', '44px');
  });

  test('focused and all-ayah layouts remain usable on narrow phones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const controls = page.getByRole('region', { name: 'إعدادات عرض جلسة الحفظ' });
    const allAyahs = controls.getByRole('button', { name: 'كل آيات الجلسة' });
    await allAyahs.click();
    await expect(allAyahs).toHaveAttribute('aria-pressed', 'true');
    await expect(allAyahs).toHaveCSS('min-height', '44px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
