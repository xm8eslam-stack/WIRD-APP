import { expect, test } from '@playwright/test';

test.describe('WIRD memorization plans UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/plans');
  });

  test('plan library tabs expose selected state accessibly', async ({ page }) => {
    const selector = page.getByRole('group', { name: 'طرق إدارة خطط الحفظ' });
    await expect(selector).toBeVisible();
    const engineTab = selector.getByRole('button', { name: /محرك التخطيط الذكي/ });
    const presetsTab = selector.getByRole('button', { name: /النماذج والخطط المعتمدة/ });

    await expect(engineTab).toHaveAttribute('aria-pressed', 'true');
    await expect(presetsTab).toHaveAttribute('aria-pressed', 'false');
    await expect(engineTab).toHaveCSS('min-height', '44px');
    await presetsTab.click();
    await expect(presetsTab).toHaveAttribute('aria-pressed', 'true');
    await expect(engineTab).toHaveAttribute('aria-pressed', 'false');
    const planProgress = page.getByRole('progressbar');
    for (const progress of await planProgress.all()) {
      await expect(progress).toHaveAttribute('aria-valuetext', /%/);
      await expect(progress).toHaveAttribute('aria-label', /نسبة إنجاز خطة/);
    }
  });

  test('planning wizard pacing and rest-day controls are keyboard and touch accessible', async ({ page }) => {
    await page.getByRole('button', { name: /إنشاء خطة ذكية جديدة/ }).click();

    const versesPace = page.getByRole('button', { name: /عدد آيات ثابت/ });
    const pagesPace = page.getByRole('button', { name: /عدد صفحات ثابت/ });
    await expect(versesPace).toHaveAttribute('aria-pressed', 'true');
    await expect(versesPace).toHaveCSS('min-height', '44px');
    await pagesPace.click();
    await expect(pagesPace).toHaveAttribute('aria-pressed', 'true');
    await expect(versesPace).toHaveAttribute('aria-pressed', 'false');

    const friday = page.getByRole('button', { name: 'الجمعة (راحة)' });
    await expect(friday).toHaveAttribute('aria-pressed', 'false');
    await expect(friday).toHaveCSS('min-height', '44px');
    await friday.click();
    await expect(page.getByRole('button', { name: 'الجمعة ✓' })).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByRole('button', { name: /معاينة الجدول الزمني المقترح/ })).toHaveCSS('min-height', '44px');
  });
});
