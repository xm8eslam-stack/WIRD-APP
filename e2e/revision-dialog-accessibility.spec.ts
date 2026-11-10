import { expect, test } from '@playwright/test';

test.describe('WIRD revision center dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/revision');
    await expect(page.getByRole('heading', { name: 'مركز المراجعة ومنظومة قياس جودة الرسوخ' })).toBeVisible();
  });

  test('add-portion dialog labels controls, traps focus, and restores its trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'إضافة مقطع متابعة جديد' });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'إضافة مقطع حفظ ومراجعة جديد' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'اختر السورة للمقطع الجديد' })).toHaveCSS('min-height', '44px');
    await expect(dialog.getByRole('spinbutton', { name: 'بداية المقطع من الآية' })).toHaveCSS('min-height', '44px');
    await expect(dialog.getByRole('spinbutton', { name: 'نهاية المقطع عند الآية' })).toHaveCSS('min-height', '44px');

    const submit = dialog.getByRole('button', { name: 'إضافة المقطع' });
    await page.keyboard.press('Shift+Tab');
    await expect(submit).toBeFocused();
    const close = dialog.getByRole('button', { name: 'إغلاق نافذة إضافة المقطع' });
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('manual weak-verse dialog exposes labelled fields and closes with Escape', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'تسجيل آية ملتبسة' });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'تسجيل آية ملتبسة أو متعثرة يدوياً' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'اختر سورة الآية الملتبسة' })).toBeVisible();
    await expect(dialog.getByRole('spinbutton', { name: 'رقم الآية الملتبسة' })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'نص الآية أو جزء منها' })).toHaveCSS('min-height', '44px');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('revision center dialogs fit a narrow phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'إضافة مقطع متابعة جديد' }).click();
    await expect(page.getByRole('dialog', { name: 'إضافة مقطع حفظ ومراجعة جديد' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
