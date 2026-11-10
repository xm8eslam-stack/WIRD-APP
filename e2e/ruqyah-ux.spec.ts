import { expect, test } from '@playwright/test';

test.describe('WIRD ruqyah UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/ruqyah');
  });

  test('ruqyah categories and recitation controls remain accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const brief = page.getByRole('button', { name: 'الرقية المختصرة' });
    const medium = page.getByRole('button', { name: 'الرقية المتوسطة' });
    await expect(brief).toHaveAttribute('aria-pressed', 'true');
    await expect(brief).toHaveCSS('min-height', '64px');
    await medium.click();
    await expect(medium).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByRole('combobox', { name: 'اختيار قارئ الرقية' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: 'تشغيل آيات القسم' })).toHaveCSS('min-height', '44px');
  });

  test('expanded index uses WIRD Quran text and offers usable search controls', async ({ page }) => {
    await page.route('**/api/ruqyah?*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', data: [{ id: 1, title: '1:1-7' }] })
    }));

    const expandedLibrary = page.getByRole('button', { name: 'المكتبة الموسعة' });
    await expandedLibrary.click();
    await expect(expandedLibrary).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByRole('combobox', { name: 'تقسيم فهرس مواضع الآيات' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('searchbox', { name: 'البحث في فهرس مواضع الآيات' })).toHaveCSS('min-height', '44px');
    await expect(page.getByText('سورة الفاتحة')).toBeVisible();
  });
});
