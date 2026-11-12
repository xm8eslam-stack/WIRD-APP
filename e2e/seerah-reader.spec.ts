import { expect, test } from '@playwright/test';

test.describe('WIRD Seerah reader bookmarks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/seerah');
    await expect(page.getByRole('heading', { name: 'حكاية السيرة' })).toBeVisible();
  });

  test('a saved scene bookmark survives reload and can be removed', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: 'حفظ علامة لهذا المشهد' });
    await expect(saveButton).toHaveAttribute('aria-pressed', 'false');
    await saveButton.click();

    const removeButton = page.getByRole('button', { name: 'إزالة علامة هذا المشهد' });
    await expect(removeButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('علاماتي المحفوظة')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'حكاية السيرة' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إزالة علامة هذا المشهد' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'إزالة علامة هذا المشهد' }).click();
    await expect(page.getByRole('button', { name: 'حفظ علامة لهذا المشهد' })).toHaveAttribute('aria-pressed', 'false');

    await page.reload();
    await expect(page.getByRole('button', { name: 'حفظ علامة لهذا المشهد' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('reader exposes an explicit empty source state instead of inventing citations', async ({ page }) => {
    await page.getByRole('button', { name: 'قراءة وتعلّم' }).click();
    const context = page.getByRole('complementary', { name: 'لوحة السياق' });
    await expect(context).toBeVisible();
    await expect(context.getByRole('region', { name: 'المراجع المعتمدة' })).toBeVisible();
    await expect(context.getByText(/لا توجد إحالات معتمدة لهذا الموضع بعد/)).toBeVisible();
    await expect(context.getByText(/لن نعرض رواية تاريخية دون مرجع محدد/)).toBeVisible();
  });

  test('bookmarks are scoped to the prototype content version and return to saved scenes', async ({ page }) => {
    await page.getByRole('button', { name: 'حفظ علامة لهذا المشهد' }).click();
    await page.locator('aside').getByRole('button').filter({ hasText: 'المشهد الثاني — امتداد الحكاية' }).first().click();
    await expect(page.getByRole('heading', { name: 'المشهد الثاني — امتداد الحكاية' })).toBeVisible();

    await page.getByRole('button', { name: 'حفظ علامة لهذا المشهد' }).click();
    await expect(page.getByText('علاماتي المحفوظة')).toBeVisible();
    await expect(page.locator('aside').getByRole('button').filter({ hasText: 'المشهد الأول — بداية الفصل' })).toHaveCount(2);
    await expect(page.locator('aside').getByRole('button').filter({ hasText: 'المشهد الثاني — امتداد الحكاية' })).toHaveCount(2);
  });
});
