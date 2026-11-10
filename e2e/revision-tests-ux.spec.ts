import { expect, test } from '@playwright/test';

async function enterGuestApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  const guestEntry = page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' });
  if (await guestEntry.isVisible().catch(() => false)) await guestEntry.click();
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
    await closePortion.click();
    await expect(portionDialog).toHaveCount(0);

    const addWeakVerse = page.getByRole('button', { name: 'تسجيل آية ملتبسة' });
    await expect(addWeakVerse).toHaveCSS('min-height', '44px');
    await addWeakVerse.click();

    const weakDialog = page.getByRole('dialog', { name: 'تسجيل آية ملتبسة أو متعثرة يدوياً' });
    await expect(weakDialog).toBeVisible();
    await weakDialog.getByRole('button', { name: 'إغلاق نافذة تسجيل آية ملتبسة' }).click();
    await expect(weakDialog).toHaveCount(0);
  });

  test('memorization-test modes expose selected state and phone-sized controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterGuestApp(page);
    await page.goto('/#/tests');

    const modes = page.getByRole('group', { name: 'نوع الاختبار' });
    const completeVerse = modes.getByRole('button', { name: /أكمل الآية التالية/ });
    const randomRecall = modes.getByRole('button', { name: /عشوائي من المحفوظ/ });

    await expect(completeVerse).toHaveAttribute('aria-pressed', 'true');
    await expect(completeVerse).toHaveCSS('min-height', '44px');
    await randomRecall.click();
    await expect(randomRecall).toHaveAttribute('aria-pressed', 'true');
    await expect(randomRecall).toHaveCSS('min-height', '44px');

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
  });
});
