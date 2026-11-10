import { expect, test } from '@playwright/test';

test.describe('WIRD settings UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/settings');
  });

  test('preference controls expose selected state and comfortable touch targets', async ({ page }) => {
    const largerFont = page.getByRole('button', { name: 'أكبر' });
    await largerFont.click();
    await expect(largerFont).toHaveAttribute('aria-pressed', 'true');
    await expect(largerFont).toHaveCSS('min-height', '44px');

    const darkTheme = page.getByRole('button', { name: 'داكن ليلي' });
    await darkTheme.click();
    await expect(darkTheme).toHaveAttribute('aria-pressed', 'true');
    await expect(darkTheme).toHaveCSS('min-height', '44px');

    await expect(page.getByRole('combobox', { name: 'القارئ المفضل للتسميع' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('combobox', { name: 'عدد مرات تكرار الآية المستهدف' })).toHaveCSS('min-height', '44px');
  });

  test('offline, backup, save, and reset actions remain easy to reach on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByRole('button', { name: /تجهيز وِرد لهذا الجهاز/ })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: 'تصدير نسخة احتياطية (JSON)' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: 'استيراد نسخة احتياطية' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: 'حفظ التعديلات' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: 'إعادة ضبط المصنع للبيانات' })).toHaveCSS('min-height', '44px');

    await page.getByRole('button', { name: 'إعادة ضبط المصنع للبيانات' }).click();
    const dialog = page.getByRole('dialog', { name: 'تأكيد إعادة الضبط الافتراضي' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'إلغاء التراجع' }).click();
    await expect(dialog).toHaveCount(0);
  });
});
