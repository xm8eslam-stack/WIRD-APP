import { expect, test } from '@playwright/test';

test.describe('WIRD Quran progress map dialog accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await expect(page.getByRole('button', { name: 'المراجعة' }).first()).toBeVisible();
    await page.goto('/#/progress');
    await expect(page.getByRole('heading', { name: 'المصحف البصري التفاعلي وخريطة الحفظ' })).toBeVisible();
  });

  test('page detail dialog traps keyboard focus and restores the page trigger', async ({ page }) => {
    const pageOne = page.getByRole('button', { name: /^صفحة 1 - الفاتحة - غير محفوظ$/ });
    await expect(pageOne).toBeVisible();
    await pageOne.click();

    const dialog = page.getByRole('dialog', { name: /صفحة رقم 1/ });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: 'إغلاق تفاصيل الصفحة' });
    await expect(close).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'إغلاق', exact: true })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(pageOne).toBeFocused();
  });

  test('page status controls retain accessible selected states', async ({ page }) => {
    const pageOne = page.getByRole('button', { name: /^صفحة 1 - الفاتحة - غير محفوظ$/ });
    await pageOne.click();
    const dialog = page.getByRole('dialog', { name: /صفحة رقم 1/ });
    const notMemorized = dialog.getByRole('button', { name: 'غير محفوظ' });
    await expect(notMemorized).toHaveAttribute('aria-pressed', 'true');
    await expect(notMemorized).toHaveCSS('min-height', '44px');
  });
});
