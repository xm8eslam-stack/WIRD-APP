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

  test('empty preset library guides the user to create a plan', async ({ page }) => {
    await page.getByRole('button', { name: /النماذج والخطط المعتمدة/ }).click();
    await expect(page.getByRole('heading', { name: 'لم تحفظ أي خطة بعد' })).toBeVisible();
    await page.getByRole('button', { name: 'إنشاء خطة حفظ' }).click();
    await expect(page.getByRole('button', { name: /محرك التخطيط الذكي/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /إنشاء خطة ذكية جديدة/ })).toBeVisible();
  });

  test('plan mode selector fits narrow phones without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const selector = page.getByRole('group', { name: 'طرق إدارة خطط الحفظ' });
    const engineTab = selector.getByRole('button', { name: /محرك التخطيط الذكي/ });
    const presetsTab = selector.getByRole('button', { name: /النماذج والخطط المعتمدة/ });
    const tabWidths = await Promise.all([engineTab, presetsTab].map(tab => tab.evaluate(element => element.getBoundingClientRect().width)));
    expect(tabWidths[0]).toBeGreaterThan(320);
    expect(Math.abs(tabWidths[0] - tabWidths[1])).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await presetsTab.click();
    await expect(presetsTab).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('delete confirmation traps focus, closes on Escape, and restores its trigger', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('wird_plans', JSON.stringify([{
        id: 'e2e-plan-delete',
        title: 'خطة اختبار الحذف',
        description: 'خطة ثابتة لاختبار إمكانية الوصول فقط',
        type: 'custom',
        totalUnits: 20,
        completedUnits: 0,
        unitType: 'ayah',
        dailyTarget: 2,
        memorizationDaysPerWeek: 5,
        revisionDaysPerWeek: 2,
        startDate: '2026-11-10',
        targetEndDate: '2026-12-10',
        isActive: true
      }]));
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' })).toHaveCount(0);
    await page.getByRole('button', { name: /النماذج والخطط المعتمدة/ }).click();
    const trigger = page.getByRole('button', { name: /حذف الخطة/ }).first();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'تأكيد حذف الخطة' });
    const cancel = dialog.getByRole('button', { name: 'إلغاء' });
    const confirm = dialog.getByRole('button', { name: 'تأكيد الحذف' });
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
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
