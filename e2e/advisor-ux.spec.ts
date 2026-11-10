import { expect, test } from '@playwright/test';

test.describe('WIRD Quran advisor UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/advisor');
  });

  test('advisor tabs expose selected state and the mutashabihat disclaimer', async ({ page }) => {
    const advisorTab = page.getByRole('button', { name: /المستشار الذكي وتحليل وتيرة الحفظ/ });
    const rulesTab = page.getByRole('button', { name: 'قواعد ضبط المتشابهات' });

    await expect(advisorTab).toHaveAttribute('aria-pressed', 'true');
    await expect(advisorTab).toHaveCSS('min-height', '44px');
    await rulesTab.click();
    await expect(rulesTab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/وسائل تذكّر مساعدة وليست قواعد قطعية/)).toBeVisible();

    await advisorTab.click();
    await expect(advisorTab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/لا تعتمد عليه في نقل نص القرآن أو تفسيره/)).toBeVisible();
  });

  test('advisor quick actions and chat controls are accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByRole('button', { name: /تحليل وتيرة الحفظ والمراجعة/ })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('textbox', { name: 'رسالتك إلى المستشار القرآني' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: 'إرسال الرسالة' })).toHaveCSS('min-height', '44px');

    await page.getByRole('button', { name: 'حاسبة التخطيط القرآني' }).click();
    await expect(page.getByRole('combobox')).toHaveCSS('min-height', '44px');
  });
});
