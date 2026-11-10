import { expect, test } from '@playwright/test';

test('connected reading displays official Tanzil Simple text by coordinate and fits the viewport', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /تلاوة ودراسة: سورة/ }).click();

  await expect(page.getByRole('link', { name: 'Tanzil Project' })).toHaveAttribute('href', 'https://tanzil.net');
  await expect(page.getByRole('button', { name: 'قراءة متصلة' })).toBeVisible();
  await page.getByRole('button', { name: 'قراءة متصلة' }).click();
  await expect(page.getByLabel('قراءة متصلة لسورة الفاتحة')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تفسير سورة الفاتحة، الآية 1' })).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);

  await page.getByRole('button', { name: /السور \(/ }).click();
  await page.getByRole('button', { name: 'فتح سورة فصلت للدراسة' }).click();
  await page.getByRole('button', { name: /تلاوة ودراسة: سورة فصلت/ }).click();
  await page.getByRole('button', { name: 'قراءة متصلة' }).click();

  const problematicAyah = page.getByRole('button', { name: 'تفسير سورة فصلت، الآية 7' });
  await expect(problematicAyah).toBeVisible();
  await expect(problematicAyah.locator('.quran-text')).toHaveText('الَّذِينَ لَا يُؤْتُونَ الزَّكَاةَ وَهُم بِالْآخِرَةِ هُمْ كَافِرُونَ');
  await expect(problematicAyah.locator('.quran-text')).toHaveAttribute('dir', 'rtl');
  await problematicAyah.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('wird.quran.lastReadingPosition.v1') || 'null'))).toEqual({ surahNumber: 41, ayahNumber: 7 });
});

test('reading position can be restored directly to its Surah and ayah', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wird.quran.lastReadingPosition.v1', JSON.stringify({ surahNumber: 41, ayahNumber: 7 }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /متابعة آخر موضع قراءة.*سورة فصلت.*الآية 7/ }).click();
  await expect(page.getByRole('button', { name: 'تفسير سورة فصلت، الآية 7' })).toBeInViewport();
});


test('Surah directory cards expose a keyboard-operable study action', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await expect(page.getByRole('button', { name: 'فتح سورة الفاتحة للدراسة' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'فتح سورة البقرة للدراسة' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /تلاوة ودراسة: سورة البقرة/ })).toBeVisible();
});


test('Mushaf page jump rejects invalid pages and accepts a valid page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /فتح المصحف بالصفحات/ }).click();

  const pageInput = page.getByRole('spinbutton', { name: 'رقم صفحة المصحف' });
  await pageInput.fill('605');
  await page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' }).click();
  await expect(page.getByRole('alert')).toHaveText('أدخل رقم صفحة صحيحاً من 1 إلى 604.');

  await pageInput.fill('2');
  await page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' }).click();
  await expect(page.getByText('2 / 604')).toBeVisible();
});


test('Mushaf primary touch controls meet the 44px minimum target on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /فتح المصحف بالصفحات/ }).click();

  await expect(page.getByRole('button', { name: 'الصفحة السابقة' })).toHaveCSS('min-height', '44px');
  await expect(page.getByRole('button', { name: 'الصفحة التالية' })).toHaveCSS('min-height', '44px');
  await expect(page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' })).toHaveCSS('min-height', '44px');
  await expect(page.getByRole('button', { name: 'استماع للصفحة' })).toHaveCSS('min-height', '44px');
});


test('Tafsir dialog supports Escape, traps keyboard focus, and restores the ayah action focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /تلاوة ودراسة: سورة/ }).click();
  await page.getByRole('button', { name: 'قراءة متصلة' }).click();

  const ayahAction = page.getByRole('button', { name: 'تفسير سورة الفاتحة، الآية 1' });
  await ayahAction.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const closeButton = dialog.getByRole('button', { name: 'إغلاق التفسير' });
  const developerLink = dialog.getByRole('link', { name: 'منصة مطوري Quran.com' });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'نسخ الآية والتفسير' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(developerLink).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(ayahAction).toBeFocused();
});
