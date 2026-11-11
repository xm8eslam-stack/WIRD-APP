import { expect, test } from '@playwright/test';

test.describe('WIRD memorization session display controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/session?surah=67&start=1&end=10&mode=memorize');
    await expect(page.getByRole('region', { name: 'إعدادات عرض جلسة الحفظ' })).toBeVisible();
  });

  test('text size, interface scale, and density controls expose accessible values and touch targets', async ({ page }) => {
    const controls = page.getByRole('region', { name: 'إعدادات عرض جلسة الحفظ' });
    const uiScale = controls.getByRole('slider', { name: 'حجم واجهة جلسة الحفظ' });
    const fontSize = controls.getByRole('slider', { name: 'حجم خط الآيات' });
    await expect(uiScale).toHaveCSS('min-height', '44px');
    await expect(fontSize).toHaveCSS('min-height', '44px');

    await uiScale.focus();
    await page.keyboard.press('ArrowRight');
    await expect(controls.locator('output[for="session-ui-scale"]')).toContainText('%');
    await fontSize.focus();
    await page.keyboard.press('ArrowRight');
    await expect(controls.locator('output[for="session-ayah-font-size"]')).toContainText('px');

    const compact = controls.getByRole('button', { name: 'مضغوطة' });
    await compact.click();
    await expect(compact).toHaveAttribute('aria-pressed', 'true');
    await expect(compact).toHaveCSS('min-height', '44px');
  });

  test('focused and all-ayah layouts remain usable on narrow phones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const controls = page.getByRole('region', { name: 'إعدادات عرض جلسة الحفظ' });
    const allAyahs = controls.getByRole('button', { name: 'كل آيات الجلسة' });
    await allAyahs.click();
    await expect(allAyahs).toHaveAttribute('aria-pressed', 'true');
    await expect(allAyahs).toHaveCSS('min-height', '44px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test('sticky navigation can jump directly to any ayah in the selected session', async ({ page }) => {
    const jump = page.getByRole('combobox', { name: 'الانتقال المباشر إلى آية في الجلسة' });
    await expect(jump).toBeVisible();
    await expect(jump).toHaveCSS('min-height', '56px');

    await jump.selectOption('4');
    await expect(jump).toHaveValue('4');
    await expect(page.getByRole('progressbar', { name: 'تقدم جلسة الحفظ' })).toHaveAttribute('aria-valuenow', '5');
    await expect(page.getByText('الآية 5 من 10')).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(jump).toBeInViewport();
  });

  test('page width persists, reset restores defaults, and direct jumps keep the selected ayah visible', async ({ page }) => {
    const controls = page.getByRole('region', { name: 'إعدادات عرض جلسة الحفظ' });
    await controls.getByRole('button', { name: 'كل آيات الجلسة' }).click();

    const widthControls = controls.getByRole('group', { name: 'عرض مساحة صفحة الحفظ' });
    const session = page.locator('[data-session-page-width]');
    await widthControls.getByRole('button', { name: 'واسعة' }).click();
    await expect(session).toHaveAttribute('data-session-page-width', 'wide');
    const wideMaxWidth = await session.evaluate(element => getComputedStyle(element).maxWidth);

    await widthControls.getByRole('button', { name: 'ملء العرض' }).click();
    await expect(session).toHaveAttribute('data-session-page-width', 'full');
    const fullMaxWidth = await session.evaluate(element => getComputedStyle(element).maxWidth);
    expect(fullMaxWidth).not.toBe(wideMaxWidth);

    await page.reload();
    await expect(controls).toBeVisible();
    await expect(controls.getByRole('button', { name: 'كل آيات الجلسة' })).toHaveAttribute('aria-pressed', 'true');
    await expect(controls.getByRole('group', { name: 'عرض مساحة صفحة الحفظ' }).getByRole('button', { name: 'ملء العرض' })).toHaveAttribute('aria-pressed', 'true');

    const pageList = page.getByRole('region', { name: 'كل آيات الجلسة' });
    const jump = page.getByRole('combobox', { name: 'الانتقال المباشر إلى آية في الجلسة' });
    await jump.selectOption('8');
    await expect(page.getByRole('progressbar', { name: 'تقدم جلسة الحفظ' })).toHaveAttribute('aria-valuenow', '9');
    const activeAyah = pageList.getByRole('button', { pressed: true });
    await expect(activeAyah).toBeVisible();
    await expect(activeAyah).toBeInViewport();

    await controls.getByRole('button', { name: 'إعادة ضبط العرض' }).click();
    await expect(session).toHaveAttribute('data-session-page-width', 'comfortable');
    await expect(controls.getByRole('group', { name: 'عرض مساحة صفحة الحفظ' }).getByRole('button', { name: 'مريحة' })).toHaveAttribute('aria-pressed', 'true');

    await page.setViewportSize({ width: 390, height: 844 });
    await controls.getByRole('group', { name: 'عرض مساحة صفحة الحفظ' }).getByRole('button', { name: 'ملء العرض' }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

});
