import { expect, test } from '@playwright/test';

async function enterGuestApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  const guestEntry = page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' });
  if (await guestEntry.isVisible().catch(() => false)) {
    await guestEntry.click();
    await expect(page.getByRole('button', { name: 'المراجعة' })).toBeVisible();
  }
}

test.describe('WIRD revision and memorization-test UX', () => {
  test('revision dialogs expose accessible names and comfortable touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterGuestApp(page);
    await page.goto('/#/revision');

    const addPortion = page.getByRole('button', { name: 'إضافة مقطع متابعة جديد' });
    await expect(addPortion).toHaveCSS('min-height', '44px');
    await addPortion.click();

    await expect(page.getByRole('heading', { name: 'إضافة مقطع حفظ ومراجعة جديد' })).toBeVisible();
    await expect(addPortion).toHaveCSS('min-height', '44px');
  });

});
