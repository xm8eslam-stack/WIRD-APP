import { expect, test } from '@playwright/test';

test.describe('WIRD progress map UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/progress');
  });

  test('page, juz, and status filters expose their selected state', async ({ page }) => {
    const pagesTab = page.getByRole('button', { name: 'صفحات المصحف (604)' });
    const juzTab = page.getByRole('button', { name: 'أجزاء القرآن (30)' });
    await expect(pagesTab).toHaveAttribute('aria-pressed', 'true');
    await expect(juzTab).toHaveAttribute('aria-pressed', 'false');

    await juzTab.click();
    await expect(juzTab).toHaveAttribute('aria-pressed', 'true');
    await expect(pagesTab).toHaveAttribute('aria-pressed', 'false');

    await pagesTab.click();
    const allFilter = page.getByRole('button', { name: 'الكل (604)' });
    await expect(allFilter).toHaveAttribute('aria-pressed', 'true');
    const stableFilter = page.getByRole('button', { name: /راسخ ومتقن/ });
    await stableFilter.click();
    await expect(stableFilter).toHaveAttribute('aria-pressed', 'true');
  });

  test('page-grid zoom presets expose selected state and comfortable touch targets', async ({ page }) => {
    const zoom = page.getByRole('group', { name: 'تكبير خريطة الصفحات' });
    const smaller = zoom.getByRole('button', { name: 'أصغر' });
    const normal = zoom.getByRole('button', { name: 'متوسط' });
    const larger = zoom.getByRole('button', { name: 'أكبر' });

    await expect(normal).toHaveAttribute('aria-pressed', 'true');
    for (const control of [smaller, normal, larger]) {
      await expect(control).toHaveCSS('min-height', '44px');
    }
    await larger.click();
    await expect(larger).toHaveAttribute('aria-pressed', 'true');
    await expect(normal).toHaveAttribute('aria-pressed', 'false');
  });

  test('page inspection traps focus, restores its trigger, and stays within a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const trigger = page.getByRole('button', { name: /صفحة 1 - الفاتحة/ });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: /صفحة رقم 1/ });
    const close = dialog.getByRole('button', { name: 'إغلاق تفاصيل الصفحة' });
    const dismiss = dialog.getByRole('button', { name: 'إغلاق', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('الآيات 1–7');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dismiss).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    const bounds = await dialog.boundingBox();
    expect(bounds?.height).toBeLessThanOrEqual(812);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole('button', { name: 'فتح الصفحة في جلسة التسميع' }).click();
    await expect(page.getByText(/الآية 1 من 7/)).toBeVisible();
  });
});
