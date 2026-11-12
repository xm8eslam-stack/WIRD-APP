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

  test('bookmarks are scoped to the prototype content version and return to saved scenes', async ({ page }) => {
    await page.getByRole('button', { name: 'حفظ علامة لهذا المشهد' }).click();
    await page.getByRole('button', { name: 'المشهد الثاني — امتداد الحكاية', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'المشهد الثاني — امتداد الحكاية' })).toBeVisible();

    await page.getByRole('button', { name: 'حفظ علامة لهذا المشهد' }).click();
    await expect(page.getByText('علاماتي المحفوظة')).toBeVisible();
    await expect(page.locator('aside').getByRole('button', { name: 'المشهد الأول — بداية الفصل', exact: true })).toHaveCount(2);
    await expect(page.locator('aside').getByRole('button', { name: 'المشهد الثاني — امتداد الحكاية', exact: true })).toHaveCount(2);
  });
});
