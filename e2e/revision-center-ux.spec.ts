import { expect, test } from '@playwright/test';

test.describe('WIRD revision center UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/revision');
  });

  test('failed-rating dialog traps keyboard focus, closes on Escape, and restores its trigger', async ({ page }) => {
    await page.getByRole('button', { name: 'إضافة مقطع متابعة جديد' }).click();
    await expect(page.getByRole('heading', { name: 'إضافة مقطع حفظ ومراجعة جديد' })).toBeVisible();
    await page.locator('form').last().getByRole('button', { name: 'إضافة المقطع' }).click();

    const trigger = page.getByRole('button', { name: 'غير متقنة (يتفلت)' }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: /تسجيل تعثر في سورة/ });
    const close = dialog.getByRole('button', { name: 'إغلاق نافذة تسجيل التعثر' });
    const confirm = dialog.getByRole('button', { name: /تأكيد التسجيل كـ/ });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('weekly revision overview adapts its columns to tablet and desktop widths', async ({ page }) => {
    const weeklyTab = page.getByRole('button', { name: 'نظرة أسبوعية للمراجعات' });
    await expect(weeklyTab).toHaveAttribute('aria-pressed', 'false');
    await weeklyTab.click();
    await expect(weeklyTab).toHaveAttribute('aria-pressed', 'true');

    const weeklyGrid = page.getByRole('region', { name: 'جدول المراجعات الأسبوعي' });
    await expect(weeklyGrid).toBeVisible();

    await page.setViewportSize({ width: 820, height: 1180 });
    await expect.poll(() => weeklyGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(() => weeklyGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(() => weeklyGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(7);
  });

  test('revision actions expose accessible labels and comfortable touch targets', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'طابور المراجعة اليومي' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'إضافة مقطع متابعة جديد' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: 'تسجيل آية ملتبسة' })).toHaveCSS('min-height', '44px');
    // A new guest starts with an empty review queue. Add a due portion through the real UI.
    await page.getByRole('button', { name: 'إضافة مقطع متابعة جديد' }).click();
    await expect(page.getByRole('heading', { name: 'إضافة مقطع حفظ ومراجعة جديد' })).toBeVisible();
    await page.locator('form').last().getByRole('button', { name: 'إضافة المقطع' }).click();
    const successfulRating = page.getByRole('button', { name: 'ناجحة (متقن)' }).first();
    await expect(successfulRating).toBeVisible();
    await expect(successfulRating).toHaveCSS('min-height', '44px');

    await page.getByRole('button', { name: 'الآيات الملتبسة والصعبة' }).click();
    await expect(page.getByRole('textbox', { name: 'البحث في الآيات الملتبسة' })).toBeVisible();
  });
});
