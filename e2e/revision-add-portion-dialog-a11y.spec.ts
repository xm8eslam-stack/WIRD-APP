import { expect, test } from '@playwright/test';

test.describe('WIRD revision add-portion dialog accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const guestEntry = page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' });
    if (await guestEntry.isVisible().catch(() => false)) {
      await guestEntry.click();
      await expect(page.getByRole('button', { name: 'المراجعة' })).toBeVisible();
    }
    await page.goto('/#/revision');
    await expect(page.getByRole('button', { name: 'إضافة مقطع متابعة جديد' })).toBeVisible();
  });

  test('add-portion dialog has an accessible name and a phone-sized close control', async ({ page }) => {
    await page.getByRole('button', { name: 'إضافة مقطع متابعة جديد' }).click();
    const dialog = page.getByRole('dialog', { name: 'إضافة مقطع حفظ ومراجعة جديد' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const close = dialog.getByRole('button', { name: 'إغلاق نافذة إضافة مقطع' });
    await expect(close).toHaveCSS('min-height', '44px');
    await expect(close).toHaveCSS('min-width', '44px');
    await close.click();
    await expect(dialog).toHaveCount(0);
  });
});
