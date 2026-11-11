import { expect, test } from '@playwright/test';

async function enterGuestApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  const guestEntry = page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' });
  if (await guestEntry.isVisible().catch(() => false)) {
    await guestEntry.click();
    await expect(page.getByRole('button', { name: 'المراجعة' }).first()).toBeVisible();
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

    const portionDialog = page.getByRole('dialog', { name: 'إضافة مقطع حفظ ومراجعة جديد' });
    await expect(portionDialog).toBeVisible();
    const closePortion = portionDialog.getByRole('button', { name: 'إغلاق نافذة إضافة مقطع' });
    await expect(closePortion).toHaveCSS('min-height', '44px');
    await expect(closePortion).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const submitPortion = portionDialog.getByRole('button', { name: 'إضافة المقطع' });
    await expect(submitPortion).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closePortion).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(portionDialog).toHaveCount(0);
    await expect(addPortion).toBeFocused();

    await addPortion.click();
    await expect(portionDialog).toBeVisible();
    await portionDialog.getByRole('button', { name: 'إلغاء' }).click();
    await expect(portionDialog).toHaveCount(0);

    const addWeakVerse = page.getByRole('button', { name: 'تسجيل آية ملتبسة' });
    await expect(addWeakVerse).toHaveCSS('min-height', '44px');
    await addWeakVerse.click();

    const weakDialog = page.getByRole('dialog', { name: 'تسجيل آية ملتبسة أو متعثرة يدوياً' });
    await expect(weakDialog).toBeVisible();
    const closeWeakVerse = weakDialog.getByRole('button', { name: 'إغلاق نافذة تسجيل آية ملتبسة' });
    await expect(closeWeakVerse).toHaveCSS('min-height', '44px');
    await expect(closeWeakVerse).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(weakDialog).toHaveCount(0);
    await expect(addWeakVerse).toBeFocused();
  });

});
